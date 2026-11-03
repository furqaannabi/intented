import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/app.js";
import { base58, quoteMessage, type CrossChainPayment } from "../src/oneclick.js";
import { openStore } from "../src/store.js";

const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const VENDOR = "0x7284d41b5b852f2bd4c99bdf95043d84452d299c";
const DEPOSIT = "intented-1click.testnet";

// A quote signer standing in for 1Click (or the testnet stand-in), with its public key as the wallet would register it.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const QUOTE_KEY = `ed25519:${base58(publicKey.export({ format: "der", type: "spki" }).subarray(-32))}`;
const signQuote = (payload: string) => ({ payload, signature: `ed25519:${base58(sign(null, quoteMessage(payload), privateKey))}` });

function setup(crossChain?: AppDeps["crossChain"] | "fake") {
  const store = openStore(":memory:");
  const m = store.createMandate("Buy market data", "a".repeat(64));
  const started: string[] = [];
  const asked: CrossChainPayment[] = [];
  const fake: AppDeps["crossChain"] = {
    refundTo: "intented-wallet.testnet",
    quoteKey: QUOTE_KEY,
    pay: async (p) => {
      asked.push(p);
      const quote = { amountIn: "808000000000000000000", amountOut: p.amount, deadline: new Date(Date.now() + 30 * 60_000).toISOString() };
      return { deposit_address: DEPOSIT, quote: quote as never, signed_quote: signQuote(JSON.stringify({ depositAddress: DEPOSIT, ...quote })) };
    },
  };
  const app = createApp({
    store, network: "testnet", model: "m", agentToken: "t", startPipeline: (id) => started.push(id), attestationUrls: {}, redteam: () => null,
    crossChain: crossChain === "fake" ? fake : crossChain,
  });
  const propose = (cc: Record<string, unknown> = {}) =>
    app.request("/api/propose", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify({ mandate_id: m.id, cross_chain: { token: "wrap.testnet", amount: "400000", dest_chain: "base", dest_asset: BASE_USDC, recipient: VENDOR, ...cc }, context: "402" }),
    });
  return { app, store, started, asked, propose };
}

describe("POST /api/propose with cross_chain", () => {
  it("is refused with a 501 while cross-chain is off, and nothing is stored", async () => {
    const { propose, started } = setup();
    const res = await propose();
    expect(res.status).toBe(501);
    expect(started).toEqual([]);
  });

  it("quotes exact output with the wallet as the refund account, then starts the pipeline", async () => {
    const { propose, asked, started } = setup("fake");
    const res = await propose();
    expect(res.status).toBe(200);
    expect(asked).toEqual([{ amount: "400000", origin_asset: "nep141:wrap.testnet", dest_asset: BASE_USDC, recipient: VENDOR, refund_to: "intented-wallet.testnet" }]);
    expect(started).toHaveLength(1);
  });

  it("stores the transfer to the deposit address and the judge's field, and shows the deposit as simulated", async () => {
    const { app, propose, store } = setup("fake");
    const { proposal_id } = await (await propose()).json();
    const row = store.getProposal(proposal_id)!;
    expect(row.action).toMatchObject({ receiver_id: "wrap.testnet", method: "ft_transfer" });
    expect(JSON.parse(row.args)).toEqual({ receiver_id: DEPOSIT, amount: "808000000000000000000" });
    expect(row.cross_chain).toMatchObject({ deposit_address: DEPOSIT, recipient: VENDOR, amount_out: "0.4 USDC" });
    expect(row.cross_chain?.signed_quote.signature).toMatch(/^ed25519:/);
    const shown = await (await app.request(`/api/proposals/${proposal_id}`)).json();
    expect(shown.oneclick).toEqual({ deposit_address: DEPOSIT, dest_chain: "base", recipient: VENDOR, amount_out: "0.4 USDC", status: "PENDING_DEPOSIT", simulated: true });
  });

  it("is a 400 for a bad body, before any quote", async () => {
    const { propose, asked } = setup("fake");
    expect((await propose({ recipient: "intented-attacker.testnet" })).status).toBe(400);
    expect(asked).toEqual([]);
  });

  it("is a 502, with nothing stored, when the quote's signature doesn't verify", async () => {
    const forged = { ...signQuote(`{"depositAddress":"${DEPOSIT}"}`), payload: `{"depositAddress":"attacker.testnet"}` };
    const quote = { amountIn: "808000000000000000000", amountOut: "400000", deadline: new Date(Date.now() + 30 * 60_000).toISOString() };
    const { propose, started } = setup({ refundTo: "w", quoteKey: QUOTE_KEY, pay: async () => ({ deposit_address: DEPOSIT, quote: quote as never, signed_quote: forged }) });
    const res = await propose();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/signature/);
    expect(started).toEqual([]);
  });

  it("is a 502 when 1Click can't quote", async () => {
    const { propose, started } = setup({ refundTo: "w", quoteKey: QUOTE_KEY, pay: async () => { throw new Error("down"); } });
    const res = await propose();
    expect(res.status).toBe(502);
    expect(started).toEqual([]);
  });
});
