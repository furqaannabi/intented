import { describe, expect, it } from "vitest";
import { formatAmount } from "../src/tokens.js";

describe("formatAmount", () => {
  it.each([
    ["1000000000000000000000", 24, "wNEAR", "0.001 wNEAR"],
    ["1000000", 6, "USDC", "1 USDC"],
    ["1500000", 6, "USDC", "1.5 USDC"],
    ["1", 6, "USDC", "0.000001 USDC"],
    ["0", 6, "USDC", "0 USDC"],
    ["50000000", 6, "USDC", "50 USDC"],
    ["10000", 6, "USDC", "0.01 USDC"],
    ["123", 0, "X", "123 X"],
    ["340282366920938463463374607431768211455", 24, "wNEAR", "340282366920938.463463374607431768211455 wNEAR"],
  ])("formats %s with %i decimals as %s", (raw, decimals, symbol, out) => {
    expect(formatAmount(raw, decimals, symbol)).toBe(out);
  });

  it.each([["01"], ["-1"], ["1.5"], [""], ["1e6"], [" 1"], ["340282366920938463463374607431768211456"]])("refuses the raw amount %j", (raw) => {
    expect(() => formatAmount(raw, 6, "USDC")).toThrow();
  });
});
