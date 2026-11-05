import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildCrossChain, checkIntent, DEADLINE_MARGIN_MS, EXPIRY_MS } from "../src/crosschain.js";

const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const VENDOR = "0x7284d41b5b852f2bd4c99bdf95043d84452d299c";
const intent = { token: "wrap.testnet", amount: "400000", dest_chain: "base", dest_asset: BASE_USDC, recipient: VENDOR };
const body = (cc: Record<string, unknown> = {}) => ({ ...intent, ...cc });
const check = (b: unknown) => checkIntent(b, "testnet", "intent");

describe("checkIntent: the payment POST /api/quote is asked to quote", () => {
  it("accepts a payment of Base USDC paid with wNEAR", () => {
    expect(check(body())).toEqual(intent);
  });

  it("lowercases a checksummed recipient", () => {
    expect(check(body({ recipient: "0x7284D41B5B852F2BD4C99BDF95043D84452D299C" }))).toMatchObject({ recipient: VENDOR });
  });

  it.each([
    ["a token the core doesn't know", body({ token: "wrap.near" })],
    ["a zero amount", body({ amount: "0" })],
    ["a non-decimal amount", body({ amount: "0.4" })],
    ["an unknown destination asset", body({ dest_asset: "nep141:eth.omft.near" })],
    ["a chain that doesn't match the asset", body({ dest_chain: "arbitrum" })],
    ["a short recipient", body({ recipient: "0x7284d41b" })],
    ["a NEAR account as recipient", body({ recipient: "intented-vendor.testnet" })],
    ["no object", null],
  ])("refuses %s", (_, b) => {
    expect(check(b)).toHaveProperty("error");
  });
});

describe("buildCrossChain: the transfer to the deposit address, from the quote", () => {
  const now = 1_800_000_000_000;
  const DEPOSIT = "intented-1click.testnet";
  const quote = { amountIn: "808000000000000000000", amountOut: "400000", deadline: new Date(now + 30 * 60_000).toISOString() };
  const signed_quote = { payload: `{"depositAddress":"${DEPOSIT}"}`, signature: "ed25519:sig" };
  const build = (q: Partial<typeof quote> = {}) => buildCrossChain(intent, { deposit_address: DEPOSIT, quote: { ...quote, ...q }, signed_quote }, { now, simulated: true });

  it("transfers the quoted input to the deposit address, on the token the wallet pays with", () => {
    const r = build();
    if ("error" in r) throw new Error(r.error);
    expect(r.args).toBe(`{"receiver_id":"${DEPOSIT}","amount":"808000000000000000000"}`);
    expect(r.action).toEqual({
      receiver_id: "wrap.testnet", method: "ft_transfer", deposit: "1", nonce: String(now), expiry_ms: String(now + EXPIRY_MS),
      args_sha256: createHash("sha256").update(r.args, "utf8").digest("hex"),
    });
  });

  it("tells the judge the Base recipient and what it receives", () => {
    expect(build()).toMatchObject({
      cross_chain: { deposit_address: DEPOSIT, dest_chain: "base", dest_asset: BASE_USDC, recipient: VENDOR, amount_out: "0.4 USDC", deadline_ms: String(now + 30 * 60_000), signed_quote },
      oneclick: { deposit_address: DEPOSIT, recipient: VENDOR, amount_out: "0.4 USDC", status: "PENDING_DEPOSIT", simulated: true },
    });
  });

  it("expires well before a short quote's deadline", () => {
    const r = build({ deadline: new Date(now + 8 * 60_000).toISOString() });
    expect(r).toMatchObject({ action: { expiry_ms: String(now + 8 * 60_000 - DEADLINE_MARGIN_MS) } });
  });

  it.each([
    ["no deadline", { deadline: undefined }],
    ["less delivered than asked", { amountOut: "399999" }],
    ["a zero input", { amountIn: "0" }],
  ])("refuses a quote with %s", (_, q) => {
    expect(build(q as Partial<typeof quote>)).toHaveProperty("error");
  });
});
