// The Proposal shape from docs/interface-spec.md, and how the UI reads it.

import { formatUnits, nearblocksTx, TOKENS as NETWORK_TOKENS } from "./near";

export type Proposal = {
  id: string;
  created_at: number;
  updated_at: number;
  action: { receiver_id: string; method: string; args_sha256: string; deposit: string; nonce: string; expiry_ms: string };
  args: string;
  context_excerpt: string;
  status: "pending" | "allowed" | "denied" | "executed" | "failed";
  verdict: "ALLOW" | "DENY" | null;
  reason: string | null;
  model: string | null;
  chat_id: string | null;
  signature: string | null;
  signer: string | null;
  attestation_url: string | null;
  near_tx_hash?: string | null;
  /** A payment through 1Click only. On testnet every delivery is simulated: nothing reaches Base. */
  oneclick?: OneClick;
};

export type OneClick = {
  deposit_address: string;
  dest_chain: string;
  recipient: string;
  amount_out: string;
  status: string;
  dest_tx_hash?: string;
  simulated: boolean;
};

/** What the owner sees: the wallet's outcome, then for a payment through 1Click, the delivery's. */
export type Outcome = "paid" | "refused" | "failed" | "judging" | "approved" | "delivering" | "delivered" | "refunded";

export function outcome(p: Proposal): Outcome {
  const paid = walletOutcome(p);
  if (paid !== "paid" || !p.oneclick) return paid;
  if (p.oneclick.status === "SUCCESS") return "delivered";
  if (p.oneclick.status === "REFUNDED") return "refunded";
  if (p.oneclick.status === "FAILED") return "failed";
  return "delivering";
}

/** The wallet contract's side alone: did it pay? */
export function walletOutcome(p: Proposal): Outcome {
  switch (p.status) {
    case "executed":
      return "paid";
    case "denied":
      return "refused";
    case "failed":
      return "failed";
    case "allowed":
      return "approved";
    default:
      return "judging";
  }
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  paid: "Paid",
  refused: "Refused",
  failed: "Failed",
  judging: "Judging",
  approved: "Approved",
  delivering: "Delivering",
  delivered: "Delivered",
  refunded: "Refunded",
};

// Tokens the UI can show in whole units: this build's network's. Others show the raw amount and the contract.
const TOKENS: Record<string, { symbol: string; decimals: number }> = Object.fromEntries(NETWORK_TOKENS.map((t) => [t.contract, t]));

function parseArgs(p: Proposal): Record<string, unknown> {
  try {
    return JSON.parse(p.args);
  } catch {
    return {};
  }
}

/** Who gets paid: the Base recipient of a payment through 1Click, the transfer's receiver_id, or the contract called. */
export function payee(p: Proposal): string {
  if (p.oneclick) return p.oneclick.recipient;
  const to = parseArgs(p).receiver_id;
  return typeof to === "string" ? to : p.action.receiver_id;
}

/** What the payee gets, e.g. "0.001 wNEAR", or "0.4 USDC" on Base. */
export function amount(p: Proposal): string {
  return p.oneclick ? p.oneclick.amount_out : walletAmount(p);
}

/** What left the wallet, in whole tokens, from the transfer's base-unit amount. */
export function walletAmount(p: Proposal): string {
  const raw = parseArgs(p).amount;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return "";
  const token = TOKENS[p.action.receiver_id];
  if (!token) return `${raw} ${p.action.receiver_id}`;
  return `${formatUnits(raw, token.decimals)} ${token.symbol}`;
}

/**
 * The model's signed reason and any pipeline error, apart. The API appends
 * pipeline errors to `reason` as " | pipeline: …"; only the text before that
 * is the model's. With no verdict, all of it is the pipeline's.
 */
export function splitReason(p: Proposal): { signed: string; error: string } {
  const reason = p.reason ?? "";
  if (!p.verdict) return { signed: "", error: reason };
  const at = reason.indexOf(" | pipeline:");
  return at < 0 ? { signed: reason, error: "" } : { signed: reason.slice(0, at), error: reason.slice(at + 3) };
}

export const shortHash = (h: string) => (h.length > 22 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h);

export const utcTime = (ms: number) => `${new Date(ms).toISOString().slice(11, 19)} UTC`;

export const utcDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const seconds = (p: Proposal) => `${((p.updated_at - p.created_at) / 1000).toFixed(1)} s`;

export const nearTxUrl = nearblocksTx;

export const baseTxUrl = (hash: string) => `https://basescan.org/tx/${hash}`;

/** "0x7284d4…d299c" */
export const shortAddress = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-5)}` : a);
