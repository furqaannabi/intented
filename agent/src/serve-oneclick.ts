// The 1Click stand-in on its own port, for testnet. Point the API's 1Click
// module at it with ONECLICK_BASE_URL. Never used on mainnet.
//
// Usage: pnpm oneclick   (reads ../.env)

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createOneClickStandIn } from "./oneclick-standin.js";
import { rpcLookupTx } from "./paywall.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

if ((process.env.NEAR_NETWORK || "testnet") !== "testnet") throw new Error("the 1Click stand-in runs on testnet only");
const port = Number(process.env.ONECLICK_STANDIN_PORT || 8403);
const rpcUrl = process.env.NEAR_RPC_URL || "https://rpc.testnet.near.org";
const depositAddress = process.env.ONECLICK_STANDIN_DEPOSIT || "";
const rate = process.env.ONECLICK_STANDIN_RATE || "50";
if (!/^([a-z0-9]+[-_.])*[a-z0-9]+\.testnet$/.test(depositAddress)) throw new Error("ONECLICK_STANDIN_DEPOSIT must be a testnet account");
if (!/^[1-9][0-9]*$/.test(rate)) throw new Error("ONECLICK_STANDIN_RATE must be whole USDC per wNEAR");

// wrap.testnet refuses an ft_transfer to an account it hasn't registered, so say so now, not at the first deposit.
const res = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "oneclick",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: "wrap.testnet",
      method_name: "storage_balance_of",
      args_base64: Buffer.from(JSON.stringify({ account_id: depositAddress })).toString("base64"),
    },
  }),
});
const view = (await res.json()) as { result?: { result: number[] } };
const registered = view.result && JSON.parse(Buffer.from(view.result.result).toString("utf8")) !== null;
if (!registered) console.warn(`warning: ${depositAddress} is not registered on wrap.testnet; deposits to it will fail`);

const app = createOneClickStandIn({ depositAddress, lookupTx: rpcLookupTx(rpcUrl), usdcPerWnear: BigInt(rate) });
serve({ fetch: app.fetch, port }, () => {
  console.log(`1Click stand-in on http://localhost:${port}: wNEAR → USDC on Base at ${rate} USDC per wNEAR, deposits to ${depositAddress}. Deliveries are simulated.`);
});
