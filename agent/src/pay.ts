// `intented pay`: propose a payment on the agent's wallet, ask the API for the verdict, and hand it to the wallet.

import type { Payment, SignedVerdict } from "./wallet.js";

/** wNEAR (and NEAR) have 24 decimals. */
const DECIMALS = 24;

/** "0.001" → "1000000000000000000000". Exact: no floating point anywhere. */
export function toYocto(amount: string): string {
  const m = /^(\d+)(?:\.(\d{1,24}))?$/.exec(amount);
  if (!m) throw new Error(`amount must be a plain number of wNEAR with at most ${DECIMALS} decimals, like 0.001 (got ${JSON.stringify(amount)})`);
  const yocto = BigInt(m[1]!) * 10n ** BigInt(DECIMALS) + BigInt((m[2] ?? "").padEnd(DECIMALS, "0"));
  if (yocto === 0n) throw new Error("amount must be more than 0");
  return yocto.toString();
}

/** What `pay` reports as it goes, for the command line to print. */
export type PayStep =
  | { step: "proposed"; proposal_id: number; near_tx_hash: string }
  | { step: "verdict"; verdict: "ALLOW" | "DENY"; reason: string; signer: string }
  | { step: "executed"; near_tx_hash: string; ok: boolean; error?: string };

export type PayResult =
  | { outcome: "paid"; proposal_id: number; execute_tx: string; reason: string }
  | { outcome: "denied"; proposal_id: number; execute_tx: string; reason: string }
  | { outcome: "failed"; proposal_id: number; execute_tx: string; reason: string; error: string }
  | { outcome: "no verdict"; proposal_id: number; error: string };

interface Verdict extends SignedVerdict {
  verdict: "ALLOW" | "DENY";
  reason: string;
  signer: string;
}

export interface PayDeps {
  walletId: string;
  payment: Payment;
  /** What the agent read that led to this payment, e.g. the paywall's 402 reply. The judge reads it as data. */
  context: string;
  agent: {
    propose(p: Payment): Promise<{ proposal_id: number; near_tx_hash: string }>;
    execute(proposalId: number, v: SignedVerdict): Promise<{ near_tx_hash: string; ok: boolean; error?: string }>;
  };
  apiUrl: string;
  fetch?: typeof fetch;
  onStep?: (s: PayStep) => void;
}

/**
 * Proposes the payment, gets the verdict on exactly that proposal, and hands it to the wallet. A DENY is handed over
 * too: the wallet refuses it on chain, which is the record. Without a verdict the proposal just expires; nothing moves.
 */
export async function pay({ walletId, payment, context, agent, apiUrl, fetch: f = fetch, onStep = () => {} }: PayDeps): Promise<PayResult> {
  const { proposal_id, near_tx_hash } = await agent.propose(payment);
  onStep({ step: "proposed", proposal_id, near_tx_hash });

  let res: Response;
  try {
    res = await f(`${apiUrl}/api/verdict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet_id: walletId, proposal_id, context }),
    });
  } catch (e) {
    return { outcome: "no verdict", proposal_id, error: `could not reach the API at ${apiUrl} (${e instanceof Error ? e.message : String(e)})` };
  }
  const body = (await res.json().catch(() => ({}))) as Partial<Verdict> & { error?: string };
  if (!res.ok || (body.verdict !== "ALLOW" && body.verdict !== "DENY")) {
    return { outcome: "no verdict", proposal_id, error: `API ${res.status}: ${body.error ?? "no verdict in the answer"}` };
  }
  const v = body as Verdict;
  onStep({ step: "verdict", verdict: v.verdict, reason: v.reason, signer: v.signer });

  const e = await agent.execute(proposal_id, v);
  onStep({ step: "executed", ...e });
  if (v.verdict === "DENY") return { outcome: "denied", proposal_id, execute_tx: e.near_tx_hash, reason: v.reason };
  if (!e.ok) return { outcome: "failed", proposal_id, execute_tx: e.near_tx_hash, reason: v.reason, error: e.error ?? "the wallet refused it" };
  return { outcome: "paid", proposal_id, execute_tx: e.near_tx_hash, reason: v.reason };
}
