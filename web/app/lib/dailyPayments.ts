// Groups a wallet's proposals into UTC days for the payments chart: what it paid, what the verdict refused, and what failed.

import type { Proposal } from "./proposal";

export const OUTCOMES = ["paid", "refused", "failed"] as const;
export type ChartOutcome = (typeof OUTCOMES)[number];

export type Day = {
  /** "2026-11-04", a UTC day: the contract's daily cap resets at UTC midnight. */
  day: string;
  /** Base units of the token, per outcome. */
  raw: Record<ChartOutcome, bigint>;
  count: Record<ChartOutcome, number>;
};

const DAY_MS = 86_400_000;

/** The proposal's outcome on the wallet, or null while it is still being judged or executed. */
function chartOutcome(p: Proposal): ChartOutcome | null {
  if (p.status === "executed") return "paid";
  if (p.status === "denied") return "refused";
  if (p.status === "failed") return "failed";
  return null;
}

/** The transfer's amount in base units, if this proposal is an ft_transfer on `tokenId`. */
function transferAmount(p: Proposal, tokenId: string): bigint | null {
  if (p.action.receiver_id !== tokenId || p.action.method !== "ft_transfer") return null;
  try {
    const amount = JSON.parse(p.args)?.amount;
    return typeof amount === "string" && /^\d+$/.test(amount) ? BigInt(amount) : null;
  } catch {
    return null;
  }
}

/**
 * The last `days` UTC days ending today, oldest first, each with the transfers of `tokenId` proposed that day,
 * by outcome. Days with nothing are kept, so the chart's axis is continuous.
 */
export function dailyPayments(proposals: Proposal[], tokenId: string, days = 14, now = Date.now()): Day[] {
  const today = Math.floor(now / DAY_MS);
  const out: Day[] = [];
  const byDay = new Map<number, Day>();
  for (let d = today - days + 1; d <= today; d++) {
    const day: Day = { day: new Date(d * DAY_MS).toISOString().slice(0, 10), raw: { paid: BigInt(0), refused: BigInt(0), failed: BigInt(0) }, count: { paid: 0, refused: 0, failed: 0 } };
    out.push(day);
    byDay.set(d, day);
  }
  for (const p of proposals) {
    const day = byDay.get(Math.floor(p.created_at / DAY_MS));
    const outcome = chartOutcome(p);
    const amount = transferAmount(p, tokenId);
    if (!day || !outcome || amount === null) continue;
    day.raw[outcome] += amount;
    day.count[outcome]++;
  }
  return out;
}

/** Every proposal the API holds, read page by page. */
export async function allProposals(): Promise<Proposal[]> {
  const PAGE = 100; // the API returns at most this many changes per call
  const byId = new Map<string, Proposal>();
  let since = 0;
  for (;;) {
    const res = await fetch(`/api/proposals?since=${since}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`The API answered ${res.status}`);
    const page: Proposal[] = await res.json();
    for (const p of page) {
      byId.set(p.id, p);
      since = Math.max(since, p.updated_at);
    }
    if (page.length < PAGE) return [...byId.values()];
  }
}
