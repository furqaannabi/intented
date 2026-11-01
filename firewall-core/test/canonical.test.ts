import { describe, expect, it } from "vitest";
import { canonicalBytes } from "../src/canonical.js";

const base = {
  receiver_id: "usdc.fakes.testnet",
  method: "ft_transfer",
  args_sha256: "a".repeat(64),
  deposit: "1",
  nonce: 7n,
  expiry_ms: 1762041600000n,
};

describe("canonicalBytes", () => {
  it("joins the fields in spec order behind INTENTED_V1", () => {
    expect(new TextDecoder().decode(canonicalBytes(base))).toBe(
      `INTENTED_V1|usdc.fakes.testnet|ft_transfer|${"a".repeat(64)}|1|7|1762041600000`,
    );
  });

  const text = (a: typeof base) => new TextDecoder().decode(canonicalBytes(a));
  const U128_MAX = "340282366920938463463374607431768211455";
  const U64_MAX = 18446744073709551615n;

  it("encodes the largest u128 deposit and u64 nonce and expiry verbatim", () => {
    expect(text({ ...base, deposit: U128_MAX, nonce: U64_MAX, expiry_ms: U64_MAX })).toBe(
      `INTENTED_V1|usdc.fakes.testnet|ft_transfer|${"a".repeat(64)}|${U128_MAX}|${U64_MAX}|${U64_MAX}`,
    );
    expect(text({ ...base, deposit: "0", nonce: 0n })).toContain("|0|0|");
  });

  it.each([
    ["leading zero", "01"],
    ["above u128", "340282366920938463463374607431768211456"],
    ["sign", "+1"],
    ["negative", "-1"],
    ["decimal point", "1.5"],
    ["exponent", "1e24"],
    ["empty", ""],
    ["space", " 1"],
  ])("rejects a deposit with %s", (_, deposit) => {
    expect(() => canonicalBytes({ ...base, deposit })).toThrow(/deposit/);
  });

  it.each([
    ["nonce", { nonce: -1n }],
    ["nonce", { nonce: U64_MAX + 1n }],
    ["expiry_ms", { expiry_ms: -1n }],
    ["expiry_ms", { expiry_ms: U64_MAX + 1n }],
  ])("rejects a %s outside u64", (field, patch) => {
    expect(() => canonicalBytes({ ...base, ...patch })).toThrow(new RegExp(field));
  });

  it.each([
    "intented-owner.testnet",
    "a.b-c_d.near",
    "ab",
    "f".repeat(64),
    "0x" + "ab".repeat(20),
  ])("accepts the valid account id %s", (receiver_id) => {
    expect(text({ ...base, receiver_id })).toContain(`|${receiver_id}|`);
  });

  it.each([
    ["unicode", "vendør.testnet"],
    ["uppercase", "Vendor.testnet"],
    ["a pipe", "vendor|evil.testnet"],
    ["too short", "a"],
    ["too long", "a".repeat(65)],
    ["consecutive separators", "a..b.testnet"],
    ["a leading separator", ".vendor.testnet"],
    ["a trailing separator", "vendor.testnet."],
    ["whitespace", "vendor.testnet "],
  ])("rejects a receiver_id with %s", (_, receiver_id) => {
    expect(() => canonicalBytes({ ...base, receiver_id })).toThrow(/receiver_id/);
  });

  it.each([["empty", ""], ["a pipe", "ft|transfer"], ["unicode", "ft_trаnsfer"], ["a leading digit", "1go"]])(
    "rejects a method with %s",
    (_, method) => {
      expect(() => canonicalBytes({ ...base, method })).toThrow(/method/);
    },
  );

  it.each([["uppercase hex", "A".repeat(64)], ["63 chars", "a".repeat(63)], ["0x prefix", "0x" + "a".repeat(64)]])(
    "rejects an args_sha256 with %s",
    (_, args_sha256) => {
      expect(() => canonicalBytes({ ...base, args_sha256 })).toThrow(/args_sha256/);
    },
  );
});
