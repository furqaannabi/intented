import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findPayment } from "../src/payment.js";

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/tx-${name}.json`, import.meta.url), "utf8"));
const honest = load("honest");
const refused = load("refused");

const asked = { asset: "wrap.testnet", payTo: "intented-vendor.testnet", amount: "1000000000000000000000" };

describe("findPayment", () => {
  it("accepts the testnet transaction that paid the vendor", () => {
    expect(findPayment(honest, asked)).toEqual({ ok: true, payer: "intented-wallet.testnet" });
  });

  it("rejects a transfer of a different amount, recipient or token", () => {
    expect(findPayment(honest, { ...asked, amount: "10000000000000000000000" }).ok).toBe(false);
    expect(findPayment(honest, { ...asked, payTo: "intented-attacker.testnet" }).ok).toBe(false);
    expect(findPayment(honest, { ...asked, asset: "usdc.fakes.testnet" }).ok).toBe(false);
  });

  it("rejects a transfer whose receipt failed", () => {
    const failed = structuredClone(honest);
    const transfer = failed.receipts.find((r: { receiver_id: string }) => r.receiver_id === "wrap.testnet");
    const outcome = failed.receipts_outcome.find((o: { id: string }) => o.id === transfer.receipt_id);
    outcome.outcome.status = { Failure: { ActionError: { index: 0, kind: {} } } };
    expect(findPayment(failed, asked).ok).toBe(false);
  });

  it("rejects the wallet's refused execute, which moved nothing", () => {
    expect(findPayment(refused, { ...asked, payTo: "intented-attacker.testnet", amount: "10000000000000000000000" }).ok).toBe(false);
  });
});
