// The API server: wires the firewall core, the wallet and SQLite into the app,
// settles anything a previous run left unfinished, then listens.
//
// Usage: pnpm start   (reads ../.env)

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createChainClient, createJudge, systemPrompt, type Network } from "@intented/firewall-core";
import { createApp } from "./app.js";
import { loadAttestationUrls } from "./attestations.js";
import { createOneClick, ONE_CLICK_MANAGER_KEY } from "./oneclick.js";
import { createPipeline } from "./pipeline.js";
import { createRedteamReader } from "./redteam.js";
import { openStore } from "./store.js";
import { createWalletReader } from "./wallet.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
// Where the published reports are read on the web: the public repo's copy of docs/attestations.
const ATTESTATIONS_URL = "https://github.com/furqaannabi/intented/blob/main/docs/attestations";
const env = (k: string) => process.env[k] || (() => { throw new Error(`${k} must be set`); })();

const network = (process.env.NEAR_NETWORK || "testnet") as Network;
const model = env("NEAR_AI_MODEL");
const rpcUrl = process.env.NEAR_RPC_URL || `https://rpc.${network}.near.org`;
const walletId = env("CONTRACT_ACCOUNT_ID");
const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);
const agentId = env("AGENT_ACCOUNT_ID");
// On testnet ONECLICK_BASE_URL points at the stand-in (agent/: pnpm oneclick); unset, it is the real 1Click.
const oneclick = createOneClick({ jwt: process.env.ONECLICK_JWT || undefined, baseUrl: process.env.ONECLICK_BASE_URL || undefined });
// Whose key signs quotes: 1Click's on mainnet; on any other network the stand-in's, and only with the stand-in's URL,
// so a testnet API never quotes against the real 1Click. Without both, cross-chain proposals get a 501.
const quoteKey = network === "mainnet"
  ? ONE_CLICK_MANAGER_KEY
  : process.env.ONECLICK_BASE_URL && process.env.ONECLICK_STANDIN_PUBLIC_KEY ? process.env.ONECLICK_STANDIN_PUBLIC_KEY : undefined;

const store = openStore(process.env.DATABASE_PATH || join(root, "intented.db"));
const pipeline = createPipeline({
  store,
  judge: createJudge({ apiKey: env("NEAR_AI_API_KEY"), model, network }),
  chain: createChainClient({ rpcUrl, walletId, agentId, agentPrivateKey: env("AGENT_PRIVATE_KEY") }),
  wallet: createWalletReader(rpcUrl, walletId),
  expected: { model, promptHash: createHash("sha256").update(systemPrompt(network), "utf8").digest("hex") },
  log,
  oneclick: { client: oneclick, nearSender: agentId },
});

const app = createApp({
  store,
  network,
  model,
  agentToken: process.env.AGENT_API_TOKEN || undefined,
  startPipeline: (id) => pipeline.start(id),
  attestationUrls: loadAttestationUrls(join(root, "..", "docs", "attestations"), ATTESTATIONS_URL),
  redteam: createRedteamReader(join(root, "..", "redteam", "latest.json")),
  corsOrigins: (process.env.WEB_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  crossChain: quoteKey ? { pay: oneclick.payCrossChain, refundTo: walletId, quoteKey } : undefined,
});

pipeline.recover();
const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port }, () => {
  log(`api on :${port}, ${network}, wallet ${walletId}, model ${model}`);
  log(quoteKey ? `cross-chain on: quotes from ${process.env.ONECLICK_BASE_URL || "1Click"}, signed by ${quoteKey}` : "cross-chain off: set ONECLICK_BASE_URL and ONECLICK_STANDIN_PUBLIC_KEY (testnet stand-in)");
});
