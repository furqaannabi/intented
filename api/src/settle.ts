// What an interrupted proposal's status is, from the wallet's own record. The
// rule (decision 10 of the pipeline record): failed only when the money can
// never move, so an agent that retries a failed proposal never pays twice.

/** The wallet's own record of a proposal (`get_proposal`), or null when it has none. */
export type WalletStatus = "pending" | "allowed" | "executed" | "failed" | null;

export interface Interrupted {
  verdict: "ALLOW" | "DENY" | null;
  chain_proposal_id: number | null;
  expiry_ms: number;
}

export type Settled = { status: "executed" | "failed" | "denied"; reason: string };

/** The final status, or "wait" while the wallet could still execute it. */
export function settle(p: Interrupted, wallet: WalletStatus, now: number): Settled | "wait" {
  if (p.verdict === null) return { status: "failed", reason: "pipeline: interrupted before a verdict" };
  if (wallet === "executed") return { status: "executed", reason: "pipeline: executed, confirmed from the wallet's record" };
  // The wallet never executes a DENY. Denied, not failed, so the agent does not retry it.
  if (p.verdict === "DENY") return { status: "denied", reason: "pipeline: interrupted after a DENY verdict" };
  // execute is only ever sent after the on-chain id is stored, so without one nothing was executed.
  if (p.chain_proposal_id === null) return { status: "failed", reason: "pipeline: interrupted before the proposal reached the wallet" };
  if (wallet === "failed") return { status: "failed", reason: "pipeline: the wallet recorded the call as failed" };
  // The wallet sent the call and its outcome callback is outstanding: money may be moving, whatever the expiry.
  if (wallet === "allowed") return "wait";
  // The wallet checks expiry in execute, so once the action has expired it can never execute.
  if (now <= p.expiry_ms) return "wait";
  return { status: "failed", reason: "pipeline: interrupted; the action expired without executing" };
}
