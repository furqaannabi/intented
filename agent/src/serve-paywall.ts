// The mock x402 paywall on its own port.
//
// Usage: pnpm paywall   (reads ../.env)

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { rpcBaseReceipt } from "./base.js";
import { createPaywall, oneclickDelivery, rpcLookupTx, type BaseConfig } from "./paywall.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const port = Number(process.env.PAYWALL_PORT || 8402);
const mainnet = process.env.NEAR_NETWORK === "mainnet";
const rpcUrl = process.env.NEAR_RPC_URL || `https://rpc.${mainnet ? "mainnet" : "testnet"}.near.org`;

// The Base routes, when the vendor has a Base address: real receipts on mainnet, the 1Click stand-in on testnet.
const vendor = process.env.BASE_RECIPIENT_ADDRESS || "";
let base: BaseConfig | undefined;
if (/^0x[0-9a-fA-F]{40}$/.test(vendor)) {
  base = mainnet
    ? { vendor, lookupReceipt: rpcBaseReceipt(process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com") }
    : { vendor, lookupDelivery: oneclickDelivery(process.env.ONECLICK_BASE_URL || "http://localhost:8403") };
}

serve({ fetch: createPaywall({ lookupTx: rpcLookupTx(rpcUrl), base, network: mainnet ? "mainnet" : "testnet" }).fetch, port }, () => {
  const routes = ["/honest/market-data", "/poisoned/market-data", ...(base ? ["/base/market-data", "/base-poisoned/market-data"] : [])];
  console.log(`paywall on http://localhost:${port}: ${routes.join(", ")}`);
  if (!base) console.log("no Base routes: BASE_RECIPIENT_ADDRESS is not a Base address");
  else if (!mainnet) console.log("Base routes on testnet: deliveries come from the 1Click stand-in and are simulated");
});
