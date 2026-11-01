// The Proposal shape from docs/interface-spec.md, and how the UI reads it.

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
};

/** What the owner sees: the wallet's outcome, not the pipeline's step. */
export type Outcome = "paid" | "refused" | "failed" | "judging" | "approved";

export function outcome(p: Proposal): Outcome {
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
};

// Tokens the UI can show in whole units. Others show the raw amount and the contract.
const TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "wrap.testnet": { symbol: "wNEAR", decimals: 24 },
  "wrap.near": { symbol: "wNEAR", decimals: 24 },
};

function parseArgs(p: Proposal): Record<string, unknown> {
  try {
    return JSON.parse(p.args);
  } catch {
    return {};
  }
}

/** Who gets paid: the transfer's receiver_id, or the contract called. */
export function payee(p: Proposal): string {
  const to = parseArgs(p).receiver_id;
  return typeof to === "string" ? to : p.action.receiver_id;
}

/** The transfer amount in whole tokens, e.g. "0.001 wNEAR", from the base-unit string. */
export function amount(p: Proposal): string {
  const raw = parseArgs(p).amount;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return "";
  const token = TOKENS[p.action.receiver_id];
  if (!token) return `${raw} ${p.action.receiver_id}`;
  const padded = raw.padStart(token.decimals + 1, "0");
  const whole = padded.slice(0, -token.decimals).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-token.decimals).replace(/0+$/, "");
  return `${fraction ? `${whole}.${fraction}` : whole} ${token.symbol}`;
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

export const nearTxUrl = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
