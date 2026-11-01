import { describe, expect, it } from "vitest";
import { settle, type Interrupted } from "../src/settle.js";

const NOW = 1_000_000;
const allowed = (o: Partial<Interrupted> = {}): Interrupted => ({ verdict: "ALLOW", chain_proposal_id: 7, expiry_ms: NOW + 60_000, ...o });

describe("settle: what an interrupted proposal's status is, given the wallet's own record", () => {
  it("is executed when the wallet executed it", () => {
    expect(settle(allowed(), "executed", NOW)).toMatchObject({ status: "executed" });
  });

  it("waits while the wallet has it pending and the action can still execute", () => {
    expect(settle(allowed(), "pending", NOW)).toBe("wait");
  });

  it("is failed once the wallet has it pending and the action has expired, since the wallet now refuses execute", () => {
    expect(settle(allowed({ expiry_ms: NOW - 1 }), "pending", NOW)).toMatchObject({ status: "failed" });
  });

  it("is failed at once when it never got an on-chain id, since execute is only sent after the id is stored", () => {
    expect(settle(allowed({ chain_proposal_id: null }), null, NOW)).toMatchObject({ status: "failed" });
  });

  it("is failed at once when it never got a verdict", () => {
    expect(settle(allowed({ verdict: null, chain_proposal_id: null }), null, NOW)).toMatchObject({ status: "failed" });
  });

  it("waits while the wallet has sent the call and not recorded its outcome, expired or not", () => {
    expect(settle(allowed({ expiry_ms: NOW - 1 }), "allowed", NOW)).toBe("wait");
  });

  it("is failed at once when the wallet recorded the call as failed", () => {
    expect(settle(allowed(), "failed", NOW)).toMatchObject({ status: "failed" });
  });

  it("is denied at once for a DENY, so the agent never retries it, wherever the pipeline stopped", () => {
    for (const chain_proposal_id of [null, 7]) {
      for (const wallet of [null, "pending"] as const) {
        expect(settle(allowed({ verdict: "DENY", chain_proposal_id }), wallet, NOW)).toMatchObject({ status: "denied" });
      }
    }
  });
});
