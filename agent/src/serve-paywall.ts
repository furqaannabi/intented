// The mock x402 paywall on its own port.
//
// Usage: pnpm paywall   (reads ../.env)

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createPaywall, rpcLookupTx } from "./paywall.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const port = Number(process.env.PAYWALL_PORT || 8402);
const rpcUrl = process.env.NEAR_RPC_URL || "https://rpc.testnet.near.org";

serve({ fetch: createPaywall({ lookupTx: rpcLookupTx(rpcUrl) }).fetch, port }, () => {
  console.log(`paywall on http://localhost:${port}: /honest/market-data, /poisoned/market-data`);
});
