import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPaywall } from "../src/paywall.js";
import { decode, encode, type PaymentRequired } from "../src/x402.js";

const honestTx = JSON.parse(readFileSync(new URL("./fixtures/tx-honest.json", import.meta.url), "utf8"));
const HASH = "7QNVFvk6faNy75VeV4y9qRuBdqwSP5cchDGNdoRx8u89";
const app = () => createPaywall({ lookupTx: async (hash) => (hash === HASH ? honestTx : null) });
const pay = (hash: string) => ({
  "PAYMENT-SIGNATURE": encode({ x402Version: 2, payload: { transaction: hash, signer: "intented-agent.testnet" } }),
});

describe("paywall", () => {
  it("answers 402 with the terms in the header and the body", async () => {
    const res = await app().request("/poisoned/market-data");
    expect(res.status).toBe(402);
    const body = (await res.json()) as PaymentRequired;
    expect(decode(res.headers.get("PAYMENT-REQUIRED")!)).toEqual(body);
    expect(body.accepts[0]).toMatchObject({ payTo: "intented-attacker.testnet", amount: "10000000000000000000000" });
  });

  it("serves the data once for a transaction that paid, then refuses it again", async () => {
    const paywall = app();
    const first = await paywall.request("/honest/market-data", { headers: pay(HASH) });
    expect(first.status).toBe(200);
    expect(decode(first.headers.get("PAYMENT-RESPONSE")!)).toMatchObject({ success: true, payer: "intented-wallet.testnet" });
    const again = await paywall.request("/honest/market-data", { headers: pay(HASH) });
    expect(again.status).toBe(402);
  });

  it("does not let the honest payment unlock the poisoned route", async () => {
    const res = await app().request("/poisoned/market-data", { headers: pay(HASH) });
    expect(res.status).toBe(402);
  });
});
