import { generateKeyPairSync, sign } from "node:crypto";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/app.js";
import { base58, quoteMessage, type CrossChainPayment } from "../src/oneclick.js";
import { openStore } from "../src/store.js";

const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const VENDOR = "0x7284d41b5b852f2bd4c99bdf95043d84452d299c";
const DEPOSIT = "intented-1click.testnet";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const QUOTE_KEY = `ed25519:${base58(publicKey.export({ format: "der", type: "spki" }).subarray(-32))}`;
const signQuote = (payload: string) => ({ payload, signature: `ed25519:${base58(sign(null, quoteMessage(payload), privateKey))}` });

function setup() {
  let t = Date.now();
  const store = openStore(":memory:");
  const m = store.createMandate("Buy market data", "a".repeat(64));
  const started: string[] = [];
  const quoted: CrossChainPayment[] = [];
  const crossChain: AppDeps["crossChain"] = {
    refundTo: "intented-wallet.testnet",
    quoteKey: QUOTE_KEY,
    pay: async (p) => {
      quoted.push(p);
      // A quote takes a moment, so two requests can be in flight together.
      await new Promise((r) => setTimeout(r, 10));
      const quote = { amountIn: "808000000000000000000", amountOut: p.amount, deadline: new Date(Date.now() + 30 * 60_000).toISOString() };
      return { deposit_address: DEPOSIT, quote: quote as never, signed_quote: signQuote(JSON.stringify({ depositAddress: DEPOSIT, ...quote })) };
    },
  };
  const app = createApp({
    store, network: "testnet", model: "m", agentToken: "t", startPipeline: (id) => started.push(id), attestationUrls: {}, redteam: () => null,
    crossChain, now: () => t,
  });
  const crossBody = (amount = "400000") => ({
    mandate_id: m.id, cross_chain: { token: "wrap.testnet", amount, dest_chain: "base", dest_asset: BASE_USDC, recipient: VENDOR }, context: "402",
  });
  // Fixed once, so a retry's body is byte for byte the first one's even when the clock ticks between them.
  const nearExpiry = String(Date.now() + 10 * 60_000);
  const nearBody = (nonce: string) => {
    const args = JSON.stringify({ receiver_id: "intented-vendor.testnet", amount: "1000000000000000000000" });
    const action = {
      receiver_id: "wrap.testnet", method: "ft_transfer", args_sha256: createHash("sha256").update(args).digest("hex"),
      deposit: "1", nonce, expiry_ms: nearExpiry,
    };
    return { mandate_id: m.id, action, args, context: "402" };
  };
  const propose = (body: object, key?: string) =>
    app.request("/api/propose", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json", ...(key === undefined ? {} : { "idempotency-key": key }) },
      body: JSON.stringify(body),
    });
  return { propose, crossBody, nearBody, started, quoted, advance: (ms: number) => (t += ms) };
}

describe("POST /api/propose with an Idempotency-Key", () => {
  it("gives a retried cross-chain payment the first proposal, with no second quote", async () => {
    const { propose, crossBody, started, quoted } = setup();
    const first = await (await propose(crossBody(), "buy-1")).json();
    const again = await propose(crossBody(), "buy-1");
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(first);
    expect(quoted).toHaveLength(1);
    expect(started).toEqual([first.proposal_id]);
  });

  it("quotes once when the same key arrives twice at the same moment", async () => {
    const { propose, crossBody, quoted, started } = setup();
    const both = await Promise.all([propose(crossBody(), "buy-1"), propose(crossBody(), "buy-1")]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(quoted).toHaveLength(1);
    expect(started).toHaveLength(1);
  });

  it("refuses the same key with a different body", async () => {
    const { propose, crossBody, quoted } = setup();
    await propose(crossBody(), "buy-1");
    expect((await propose(crossBody("900000"), "buy-1")).status).toBe(409);
    expect(quoted).toHaveLength(1);
  });

  it("treats a new key as a new purchase", async () => {
    const { propose, crossBody, quoted } = setup();
    await propose(crossBody(), "buy-1");
    expect((await propose(crossBody(), "buy-2")).status).toBe(200);
    expect(quoted).toHaveLength(2);
  });

  it("works for a NEAR payment too", async () => {
    const { propose, nearBody, started } = setup();
    const first = await (await propose(nearBody("1700000000000"), "buy-1")).json();
    expect(await (await propose(nearBody("1700000000000"), "buy-1")).json()).toEqual(first);
    expect(started).toHaveLength(1);
  });

  it("forgets a key after 24 hours", async () => {
    const { propose, crossBody, quoted, advance } = setup();
    await propose(crossBody(), "buy-1");
    advance(24 * 60 * 60_000);
    expect((await propose(crossBody(), "buy-1")).status).toBe(200);
    expect(quoted).toHaveLength(2);
  });

  it("refuses a malformed key before quoting", async () => {
    const { propose, crossBody, quoted } = setup();
    for (const bad of ["", "has space", "x".repeat(65), "naïve"]) expect((await propose(crossBody(), bad)).status).toBe(400);
    expect(quoted).toHaveLength(0);
  });

  it("doesn't keep a key whose request failed, so the retry can go through", async () => {
    const { propose, crossBody, quoted } = setup();
    expect((await propose({ ...crossBody(), mandate_id: "m_unknown" }, "buy-1")).status).toBe(400);
    expect((await propose(crossBody(), "buy-1")).status).toBe(200);
    expect(quoted).toHaveLength(1);
  });
});
