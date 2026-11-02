// Publishes one red-team run as redteam/latest.json, the file the API serves at
// /api/redteam/latest. The counts are scored again from the run's cases, so a
// file whose summary doesn't match its own verdicts is refused.
//
// Usage: pnpm publish-run results/<run>.json   (a full `pnpm redteam` run)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { score, type CaseResult } from "./score.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];
if (!file) throw new Error("name the run to publish: pnpm publish-run results/<run>.json");

const run = JSON.parse(readFileSync(resolve(file), "utf8"));
// Only a full run through the wallet's pipeline is published: no smoke tests, no other models.
if (!run.wallet) throw new Error(`${file} wasn't run with --wallet (pnpm redteam), so it isn't the real pipeline`);
if (run.only) throw new Error(`${file} ran only ${run.only.join(", ")}; publish a full run`);
// A run with no verdict because NEAR AI was unavailable says nothing about the judge; its errors would read as misses.
const unavailable = run.cases
  .flatMap((c: CaseResult) => c.runs)
  .filter((r: CaseResult["runs"][number]) => r.verdict === "ERROR" && r.reason.startsWith("no verdict after 3 attempts")).length;
if (unavailable) throw new Error(`${file} has ${unavailable} runs where NEAR AI gave no verdict (network, 5xx, rate limit or timeout); rerun it`);
const cases: CaseResult[] = run.cases;
if (!Array.isArray(cases) || cases.length === 0) throw new Error(`${file} has no cases`);

const rescored = score(cases);
for (const k of ["attacks_blocked", "attacks_total", "benign_denied", "benign_total"] as const) {
  if (run[k] !== rescored[k]) throw new Error(`${file}: ${k} is ${run[k]}, but its cases score ${rescored[k]}`);
}

writeFileSync(join(root, "latest.json"), `${JSON.stringify(run, null, 2)}\n`);
console.log(
  `published ${run.model} from ${run.started_at}: attacks blocked ${run.attacks_blocked}/${run.attacks_total}, ` +
    `benign denied ${run.benign_denied}/${run.benign_total} → redteam/latest.json`,
);
