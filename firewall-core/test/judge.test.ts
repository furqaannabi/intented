import { createHash } from "node:crypto";
import { Wallet, keccak256, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";
import { canonicalBytes } from "../src/canonical.js";
import { createJudge } from "../src/judge.js";

const sha = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");
const tee = new Wallet(keccak256(toUtf8Bytes("intented-judge-test-tee")));
const MODEL = "z-ai/glm-5.3-flash";
const argsJson = JSON.stringify({ receiver_id: "intented-vendor.testnet", amount: "1000" });
const action = { receiver_id: "wrap.testnet", method: "ft_transfer", args_sha256: sha(argsJson), deposit: "1", nonce: 1n, expiry_ms: 2n };
const canonical = new TextDecoder().decode(canonicalBytes(action));

/** A fake NEAR AI: answers `content`, then signs per `sign` (default: honestly). */
function fakeNearAi(content: string, sign?: (req: string, resp: string) => Promise<{ text: string; signature: string }>) {
  let req = "";
  let resp = "";
  return (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/v1/chat/completions")) {
      req = new TextDecoder().decode(init!.body as Uint8Array);
      resp = JSON.stringify({ id: "chat-1", choices: [{ message: { role: "assistant", content } }] });
      return new Response(resp);
    }
    if (u.includes("/v1/signature/chat-1")) {
      const s = sign ? await sign(req, resp) : { text: `${MODEL}:${sha(req)}:${sha(resp)}`, signature: await tee.signMessage(`${MODEL}:${sha(req)}:${sha(resp)}`) };
      return new Response(JSON.stringify({ ...s, signing_address: tee.address, signing_algo: "ecdsa" }));
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const judgeWith = (f: typeof fetch) => createJudge({ apiKey: "test", model: MODEL, network: "testnet", fetch: f });
const allow = JSON.stringify({ reason: "fits", verdict: "ALLOW", action: canonical });

describe("judge", () => {
  it("returns the verdict with the exact signed bytes and the signer", async () => {
    const r = await judgeWith(fakeNearAi(allow))("Pay the vendor.", action, argsJson, "402");
    expect(r).toMatchObject({ verdict: "ALLOW", reason: "fits", model: MODEL, chat_id: "chat-1", signer: tee.address.toLowerCase() });
    expect(await tee.signMessage(`${MODEL}:${sha(r.req_bytes)}:${sha(r.resp_bytes)}`)).toBe(r.signature);
  });

  it("turns a malformed answer into a signed DENY, never an error or an ALLOW", async () => {
    const r = await judgeWith(fakeNearAi("ALLOW"))("Pay the vendor.", action, argsJson, "402");
    expect(r.verdict).toBe("DENY");
  });

  it("refuses a signature whose text does not cover the bytes it sent and received", async () => {
    const otherBytes = fakeNearAi(allow, async () => {
      const text = `${MODEL}:${sha("other request")}:${sha("other response")}`;
      return { text, signature: await tee.signMessage(text) };
    });
    await expect(judgeWith(otherBytes)("Pay the vendor.", action, argsJson, "402")).rejects.toThrow(/signed text/);
  });

  it("refuses a signature that does not recover from its text", async () => {
    const forged = fakeNearAi(allow, async (req, resp) => ({ text: `${MODEL}:${sha(req)}:${sha(resp)}`, signature: await tee.signMessage("something else") }));
    await expect(judgeWith(forged)("Pay the vendor.", action, argsJson, "402")).rejects.toThrow(/signing_address/);
  });

  it("passes cross_chain, its fifth argument, into the signed request", async () => {
    const deposit = "ab".repeat(32);
    const ccArgs = JSON.stringify({ receiver_id: deposit, amount: "1000" });
    const cc = { ...action, args_sha256: sha(ccArgs), expiry_ms: 1_000n };
    const field = { deposit_address: deposit, dest_chain: "base", dest_asset: "nep141:base.omft.near", recipient: "0x" + "11".repeat(20), amount_out: "0.40 USDC", deadline_ms: "2000", signed_quote: { payload: "{}", signature: "ed25519:5sig" } };
    const canonicalCc = new TextDecoder().decode(canonicalBytes(cc));
    const ok = JSON.stringify({ reason: "fits", verdict: "ALLOW", action: canonicalCc });
    const r = await judgeWith(fakeNearAi(ok))("Pay the vendor on Base.", cc, ccArgs, "402", field);
    const sent = JSON.parse(JSON.parse(new TextDecoder().decode(r.req_bytes)).messages[1].content);
    expect(sent.cross_chain).toEqual(field);
    expect(r.verdict).toBe("ALLOW");
  });
});
