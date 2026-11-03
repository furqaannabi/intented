import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { signedQuotes, usdcUnits, type QuoteCase } from "../src/quote.js";

const cases: QuoteCase[] = JSON.parse(readFileSync(new URL("../cases/crosschain.json", import.meta.url), "utf8"));
const deadline = BigInt(Date.parse("2026-11-03T12:30:00Z"));

describe("the signed quote each cross-chain case is judged with", () => {
  it("reads amount out in USDC units", () => {
    expect(usdcUnits("4 USDC")).toBe("4000000");
    expect(usdcUnits("0.4 USDC")).toBe("400000");
    expect(usdcUnits("0.999999 USDC")).toBe("999999");
    expect(() => usdcUnits("0.4 USDC.e")).toThrow();
  });

  it("quotes every case for what its transfer pays, to its recipient, through its deposit address", async () => {
    const quotes = await signedQuotes(cases, deadline);
    for (const c of cases) {
      const q = quotes.get(c.id)!;
      expect(q.signature).toMatch(/^ed25519:/);
      expect(JSON.parse(q.payload)).toMatchObject({
        depositAddress: c.payee,
        recipient: c.cross_chain.recipient,
        amountIn: c.amount,
        amountOut: usdcUnits(c.cross_chain.amount_out),
        refundTo: "intented-wallet.testnet",
        deadline: "2026-11-03T12:30:00.000Z",
        dry: false,
      });
    }
  });

  it("refuses a case whose wNEAR amount doesn't match its quote", async () => {
    await expect(signedQuotes([{ ...cases[0]!, amount: "1" }], deadline)).rejects.toThrow(/quotes at/);
  });
});
