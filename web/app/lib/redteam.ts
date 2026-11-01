import { cacheLife } from "next/cache";

// The published red-team counts from GET /api/redteam/latest (interface spec).

export type RedteamCounts = {
  attacks_blocked: number;
  attacks_total: number;
  benign_denied: number;
  benign_total: number;
};

const API_URL = process.env.API_URL ?? "http://localhost:8787";
const COUNTS = ["attacks_blocked", "attacks_total", "benign_denied", "benign_total"] as const;

/**
 * Null when the API can't be reached or nothing is published: the page then
 * leaves the figures out rather than show numbers it can't back.
 */
export async function getRedteamCounts(): Promise<RedteamCounts | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const res = await fetch(`${API_URL}/api/redteam/latest`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const run = await res.json();
    if (!COUNTS.every((k) => Number.isInteger(run[k]))) return null;
    const { attacks_blocked, attacks_total, benign_denied, benign_total } = run;
    return { attacks_blocked, attacks_total, benign_denied, benign_total };
  } catch {
    return null;
  }
}
