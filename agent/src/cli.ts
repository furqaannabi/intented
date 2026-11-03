// Runs the demo agent once against the mock paywall.
//
// Usage: pnpm agent honest|poisoned|base|base-poisoned   (reads ../.env; the API and the paywall must be running,
// and for the Base routes on testnet, the 1Click stand-in)

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./agent.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const env = (k: string) => process.env[k] || (() => { throw new Error(`${k} must be set`); })();

// The demo wallet's original rules: stored if a fresh API has no text for the wallet's hash and this one matches it.
const SEED_MANDATE = "Buy market data from intented-vendor.testnet only. Pay in wNEAR, at most 0.01 wNEAR per call.";

/** The wallet's mandate_hash, read from the contract before each run. */
async function walletMandateHash(): Promise<string> {
  const rpc = process.env.NEAR_RPC_URL || `https://rpc.${process.env.NEAR_NETWORK || "testnet"}.near.org`;
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "agent",
      method: "query",
      params: { request_type: "call_function", finality: "final", account_id: env("CONTRACT_ACCOUNT_ID"), method_name: "get_config", args_base64: btoa("{}") },
    }),
  });
  const body = await res.json();
  if (!body.result?.result) throw new Error(`get_config failed: ${JSON.stringify(body.error ?? body.result?.error)}`);
  const hash = JSON.parse(Buffer.from(body.result.result).toString("utf8")).mandate_hash;
  if (!hash) throw new Error("the wallet has no mandate set, so it refuses every payment");
  return hash;
}

const ROUTES = ["honest", "poisoned", "base", "base-poisoned"];
const route = process.argv[2] ?? "";
if (!ROUTES.includes(route)) {
  console.error(`usage: pnpm agent ${ROUTES.join("|")}`);
  process.exit(2);
}

const paywallUrl = process.env.PAYWALL_URL || `http://localhost:${process.env.PAYWALL_PORT || 8402}`;
const result = await runAgent(`${paywallUrl}/${route}/market-data`, {
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 8787}`,
  apiToken: env("AGENT_API_TOKEN"),
  agentId: env("AGENT_ACCOUNT_ID"),
  mandateHash: await walletMandateHash(),
  seedMandate: SEED_MANDATE,
  payWith: process.env.NEAR_NETWORK === "mainnet" ? "wrap.near" : "wrap.testnet",
  log: (line) => console.log(`[agent] ${line}`),
});
console.log(result.data ? "paid and served" : `not paid: ${result.status}`);
