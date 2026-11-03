import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ONE_CLICK_MANAGER_KEY, signedQuote, verifySignedQuote } from "../src/oneclick.js";

// A live mainnet quote (3 November 2026): 0.4 USDC to a Base address, paid in wNEAR. Nothing was deposited.
const live = JSON.parse(readFileSync(new URL("./fixtures/oneclick-live-quote.json", import.meta.url), "utf8"));

describe("1Click's signed quote", () => {
  it("verifies a real quote with 1Click's manager key", () => {
    expect(verifySignedQuote(signedQuote(live), ONE_CLICK_MANAGER_KEY)).toBe(true);
  });

  it("signs the deposit address, recipient and refund account into the payload", () => {
    const payload = JSON.parse(signedQuote(live).payload);
    expect(payload).toMatchObject({ depositAddress: live.quote.depositAddress, recipient: live.quoteRequest.recipient, refundTo: live.quoteRequest.refundTo, dry: false });
    // Unsigned request fields stay out, or the signature wouldn't verify.
    expect(payload).not.toHaveProperty("appFees");
  });

  it("fails when one character of the deposit address changes", () => {
    const q = signedQuote(live);
    const d: string = live.quote.depositAddress;
    const other = d.slice(0, -1) + (d.endsWith("0") ? "1" : "0");
    expect(verifySignedQuote({ ...q, payload: q.payload.replace(d, other) }, ONE_CLICK_MANAGER_KEY)).toBe(false);
  });

  it("fails for a payload built from the whole response, which is not what 1Click signs", () => {
    // The signed payload with every unsigned field put back: what the original proposal described.
    const everything = { ...JSON.parse(signedQuote(live).payload), appFees: live.quoteRequest.appFees, depositMode: live.quoteRequest.depositMode };
    const keys = Object.keys(everything).sort();
    const payload = `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(everything[k])}`).join(",")}}`;
    expect(verifySignedQuote({ payload, signature: live.signature }, ONE_CLICK_MANAGER_KEY)).toBe(false);
  });

  it("fails with any other key, and with a malformed signature", () => {
    expect(verifySignedQuote(signedQuote(live), "ed25519:11111111111111111111111111111111")).toBe(false);
    expect(verifySignedQuote({ ...signedQuote(live), signature: "ed25519:0OIl" }, ONE_CLICK_MANAGER_KEY)).toBe(false);
  });
});
