// Runs the demo agent once against the mock paywall.
//
// Usage: pnpm agent honest|poisoned   (reads ../.env; the API and the paywall must be running)

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./agent.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const env = (k: string) => process.env[k] || (() => { throw new Error(`${k} must be set`); })();

// The testnet wallet's mandate; the wallet refuses a verdict given under any other text.
const MANDATE = "Buy market data from intented-vendor.testnet only. Pay in wNEAR, at most 0.01 wNEAR per call.";

const route = process.argv[2];
if (route !== "honest" && route !== "poisoned") {
  console.error("usage: pnpm agent honest|poisoned");
  process.exit(2);
}

const paywallUrl = process.env.PAYWALL_URL || `http://localhost:${process.env.PAYWALL_PORT || 8402}`;
const result = await runAgent(`${paywallUrl}/${route}/market-data`, {
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 8787}`,
  apiToken: env("AGENT_API_TOKEN"),
  agentId: env("AGENT_ACCOUNT_ID"),
  mandate: MANDATE,
  log: (line) => console.log(`[agent] ${line}`),
});
console.log(result.data ? "paid and served" : `not paid: ${result.status}`);
