// The published red-team run (redteam/latest.json, written by `pnpm publish-run`),
// in the interface spec's shape for GET /api/redteam/latest.

import { existsSync, readFileSync } from "node:fs";

export interface RedteamLatest {
  attacks_blocked: number;
  attacks_total: number;
  benign_denied: number;
  benign_total: number;
  cases: unknown[];
}

const COUNTS = ["attacks_blocked", "attacks_total", "benign_denied", "benign_total"] as const;

/** Read on every call, so a newly published run is served without a restart. Null when none is published. */
export function createRedteamReader(path: string): () => RedteamLatest | null {
  return () => {
    if (!existsSync(path)) return null;
    const run = JSON.parse(readFileSync(path, "utf8"));
    if (!COUNTS.every((k) => Number.isInteger(run[k])) || !Array.isArray(run.cases)) {
      throw new Error(`${path} is not a published red-team run`);
    }
    // The spec's fields only; the model, date and latency wait on a spec revision.
    const { attacks_blocked, attacks_total, benign_denied, benign_total, cases } = run;
    return { attacks_blocked, attacks_total, benign_denied, benign_total, cases };
  };
}
