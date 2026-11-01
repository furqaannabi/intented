import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { outcomeOf, proposalIdOf } from "../src/onchain.js";

// Real testnet outcomes (trimmed): propose of proposal 2, the honest execute, the refused poisoned execute.
const o = JSON.parse(readFileSync(new URL("./fixtures/outcomes.json", import.meta.url), "utf8"));

describe("outcomeOf", () => {
  it("reads a successful propose's hash and returned proposal id", () => {
    const r = outcomeOf(o.propose);
    expect(r).toMatchObject({ ok: true, near_tx_hash: "87SF7EhHo31dxpAohX3U3hmWCaB9byXgGkLhrzqmJuHB" });
    expect(proposalIdOf(r)).toBe(2);
  });

  it("reports an execute ok only when the token call inside it succeeded too", () => {
    expect(outcomeOf(o.execute_ok)).toMatchObject({ ok: true, near_tx_hash: "J9rtVgT94jQmwNg7oG8hmVzBeqF3cmnssUM5tr5nLkgA" });
  });

  it("reports a refused execute as not ok, with the contract's reason and the hash", () => {
    expect(outcomeOf(o.execute_refused)).toEqual({
      ok: false,
      near_tx_hash: "5JJ21D6RiN2QYkJrEtqNZ5Yp4Bs8a5G5sCfm2vZF1WMY",
      error: "Smart contract panicked: verdict is not ALLOW",
    });
  });

  it("reports an execute as not ok when the token call failed, though the callback succeeded", () => {
    const failed = structuredClone(o.execute_ok);
    const call = failed.receipts_outcome.find((r: { outcome: { executor_id: string } }) => r.outcome.executor_id === "wrap.testnet");
    call.outcome.status = { Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: The account doesn't have enough balance" } } } } };
    expect(outcomeOf(failed)).toMatchObject({ ok: false, error: "Smart contract panicked: The account doesn't have enough balance" });
  });
});

describe("proposalIdOf", () => {
  it.each([["no value", { ok: true, near_tx_hash: "h" }], ["a failed call", { ok: false, near_tx_hash: "h", error: "x" }], ["a non-integer", { ok: true, near_tx_hash: "h", value: '"2"' }], ["a negative", { ok: true, near_tx_hash: "h", value: "-1" }]])(
    "refuses %s",
    (_, r) => {
      expect(() => proposalIdOf(r)).toThrow();
    },
  );
});
