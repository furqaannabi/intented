import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkExecute } from "../src/check-tx.js";

// Real testnet transactions from 5 November: retest-1105's honest payment and its refused attack, as the RPC's tx method returns them.
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const config = fixture("retest-1105-config");
const SIGNER = "0x835ab53d20294ef795906dff21ae4c045336aa26";

describe("checkExecute", () => {
  it("recovers the allowlisted signer from a paid execute's own arguments, with the signed ALLOW and the transfer", () => {
    const r = checkExecute(fixture("execute-allow"), config);
    expect(r.signedText).toBe(
      "Qwen/Qwen3.8-27B:64b33b97ecf6d90044173fe2afa3ef28f533cdec83062482c60d56c3e2a1aa39:d727f1104542e65f57b6ad80b305e6f8a7405e6f7f2f02253197889ea63b1119",
    );
    expect(r).toMatchObject({ signer: SIGNER, allowlisted: true, verdict: "ALLOW", outcome: { ok: true } });
    expect(r.reason).toMatch(/intented-vendor\.testnet/);
    expect(r.transfers).toEqual([{ token: "wrap.testnet", from: "retest-1105.intented.testnet", to: "intented-vendor.testnet", amount: "1000000000000000000000" }]);
  });

  it("shows a refused execute: the signed DENY, the wallet's panic, and nothing transferred", () => {
    const r = checkExecute(fixture("execute-deny"), config);
    expect(r).toMatchObject({ signer: SIGNER, allowlisted: true, verdict: "DENY", outcome: { ok: false, error: "Smart contract panicked: verdict is not ALLOW" } });
    expect(r.transfers).toEqual([]);
  });

  it("says a signer the wallet doesn't allowlist isn't", () => {
    expect(checkExecute(fixture("execute-allow"), { ...config, signers: ["0x0000000000000000000000000000000000000001"] }).allowlisted).toBe(false);
  });

  it("refuses a transaction that isn't an execute", () => {
    const tx = fixture("execute-allow");
    tx.transaction.actions = [{ FunctionCall: { method_name: "propose", args: "e30=" } }];
    expect(() => checkExecute(tx, config)).toThrow(/not an execute/);
  });
});
