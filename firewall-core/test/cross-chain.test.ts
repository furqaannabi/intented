import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildJudgeRequest, type CrossChain } from "../src/prompt.js";

const DEPOSIT = "5f8c3a1e9b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f2a4c6e8b0d1f3a";
const argsJson = JSON.stringify({ receiver_id: DEPOSIT, amount: "813098000000000000000" });
const action = {
  receiver_id: "wrap.testnet",
  method: "ft_transfer",
  args_sha256: createHash("sha256").update(argsJson).digest("hex"),
  deposit: "1",
  nonce: 7n,
  expiry_ms: 1_762_200_000_000n,
};
const crossChain: CrossChain = {
  deposit_address: DEPOSIT,
  dest_chain: "base",
  dest_asset: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  recipient: "0x1111111111111111111111111111111111111111",
  amount_out: "0.40 USDC",
  deadline_ms: "1762200600000",
  signed_quote: { payload: '{"amountIn":"813098000000000000000"}', signature: "ed25519:5sig" },
};
const input = { model: "Qwen/Qwen3.8-27B", network: "testnet" as const, mandate: "Pay the vendor on Base.", action, argsJson, context: "402" };
const user = (b: ReturnType<typeof buildJudgeRequest>) => JSON.parse(b.messages[1]!.content);

describe("buildJudgeRequest with cross_chain", () => {
  it("leaves the request byte for byte as it was when there is no cross_chain", () => {
    expect(JSON.stringify(buildJudgeRequest({ ...input, crossChain: undefined }))).toBe(JSON.stringify(buildJudgeRequest(input)));
    expect(Object.keys(user(buildJudgeRequest(input)))).not.toContain("cross_chain");
  });

  it("carries the six cross_chain fields exactly, as firewall data next to the converted amount", () => {
    const u = user(buildJudgeRequest({ ...input, crossChain }));
    expect(u.cross_chain).toEqual(crossChain);
    expect(Object.keys(u.cross_chain)).toEqual(["deposit_address", "dest_chain", "dest_asset", "recipient", "amount_out", "deadline_ms", "signed_quote"]);
    expect(Object.keys(u.cross_chain.signed_quote)).toEqual(["payload", "signature"]);
    expect(u.amount).toBe("0.000813098 wNEAR");
  });

  const withArgs = (args: object, over: Partial<typeof action> = {}) => {
    const json = JSON.stringify(args);
    return { ...input, argsJson: json, action: { ...action, args_sha256: createHash("sha256").update(json).digest("hex"), ...over } };
  };

  it.each<[string, () => Parameters<typeof buildJudgeRequest>[0], RegExp]>([
    ["a method other than ft_transfer", () => ({ ...withArgs(JSON.parse(argsJson), { method: "ft_transfer_call" }), crossChain }), /ft_transfer/],
    ["a deposit_address that is not args.receiver_id", () => ({ ...input, crossChain: { ...crossChain, deposit_address: "cd".repeat(32) } }), /deposit_address/],
    ["a recipient with uppercase hex", () => ({ ...input, crossChain: { ...crossChain, recipient: "0x" + "AB".repeat(20) } }), /recipient/],
    ["a recipient without 0x", () => ({ ...input, crossChain: { ...crossChain, recipient: "11".repeat(20) } }), /recipient/],
    ["a short recipient", () => ({ ...input, crossChain: { ...crossChain, recipient: "0x" + "11".repeat(19) } }), /recipient/],
    ["a deadline_ms that is not a u64 decimal", () => ({ ...input, crossChain: { ...crossChain, deadline_ms: "1.7e12" } }), /deadline_ms/],
    ["a deadline_ms above u64", () => ({ ...input, crossChain: { ...crossChain, deadline_ms: "18446744073709551616" } }), /deadline_ms/],
    ["an expiry_ms equal to deadline_ms", () => ({ ...input, crossChain: { ...crossChain, deadline_ms: String(action.expiry_ms) } }), /expiry_ms/],
    ["no signed_quote", () => ({ ...input, crossChain: { ...crossChain, signed_quote: undefined as never } }), /signed_quote/],
    ["an empty payload", () => ({ ...input, crossChain: { ...crossChain, signed_quote: { payload: "", signature: "ed25519:5sig" } } }), /signed_quote/],
    ["a signature without ed25519:", () => ({ ...input, crossChain: { ...crossChain, signed_quote: { payload: "{}", signature: "5sig" } } }), /signed_quote/],
    ["an expiry_ms after deadline_ms", () => ({ ...input, crossChain: { ...crossChain, deadline_ms: String(action.expiry_ms - 1n) } }), /expiry_ms/],
  ])("refuses %s", (_, make, why) => {
    expect(() => buildJudgeRequest(make())).toThrow(why);
  });
});
