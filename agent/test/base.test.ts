import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_USDC_CONTRACT, findBaseTransfer } from "../src/base.js";

// A real Base mainnet USDC transfer (block 53456862): 0.02 USDC by transferWithAuthorization.
const receipt = JSON.parse(readFileSync(new URL("./fixtures/base-usdc-transfer.json", import.meta.url), "utf8"));
const asked = { asset: BASE_USDC_CONTRACT, payTo: "0x7284d41b5b852f2bd4c99bdf95043d84452d299c", amount: "20000" };

describe("findBaseTransfer", () => {
  it("accepts a real USDC transfer of the asked amount to the asked address", () => {
    expect(findBaseTransfer(receipt, asked)).toMatchObject({ ok: true });
  });

  it("matches the address whatever its letter case", () => {
    expect(findBaseTransfer(receipt, { ...asked, payTo: "0x7284D41B5B852F2BD4C99BDF95043D84452D299C" }).ok).toBe(true);
  });

  it("accepts more than the price, refuses less", () => {
    expect(findBaseTransfer(receipt, { ...asked, amount: "19999" }).ok).toBe(true);
    expect(findBaseTransfer(receipt, { ...asked, amount: "20001" }).ok).toBe(false);
  });

  it("refuses a transfer to a different address or of a different token", () => {
    expect(findBaseTransfer(receipt, { ...asked, payTo: "0xbad0000000000000000000000000000000000bad" }).ok).toBe(false);
    expect(findBaseTransfer(receipt, { ...asked, asset: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb" }).ok).toBe(false);
  });

  it("refuses a transaction that failed", () => {
    expect(findBaseTransfer({ ...receipt, status: "0x0" }, asked).ok).toBe(false);
  });
});
