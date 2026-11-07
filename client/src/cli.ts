// The `intented` command.
//
//   intented init <name>
//     Makes the agent's key for <name>.intented.testnet on this machine, keeps the private key in
//     ~/.intented/testnet/, and prints the link that creates the wallet. Never prints the private key.
//
//   intented pay <wallet> --to <account> --amount <amount> [--token <contract>] [--context <text> | --context-file <path>]
//     Proposes the payment, gets the signed verdict, and hands it to the wallet, which pays only on a valid ALLOW
//     within its caps. <wallet> is a name or a full id. Exits 0 only when the payment was made.
//
//   intented mcp
//     Runs the MCP server on stdin and stdout, for Claude Code, Cursor and Codex.
//
// INTENTED_API_URL, INTENTED_WEB_URL, INTENTED_HOME and NEAR_RPC_URL override the defaults. NEAR testnet only.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { defaults, init, pay, type PayStep } from "./index.js";
import { startMcpServer } from "./server.js";

const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
const USAGE = `usage:
  intented init <name>
  intented pay <wallet> --to <account> --amount <amount> [--token <contract>] [--context <text> | --context-file <path>]
  intented mcp
NEAR testnet only. Settings: INTENTED_API_URL (now ${defaults.apiUrl}), INTENTED_WEB_URL, INTENTED_HOME, NEAR_RPC_URL.`;
const tx = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;

function initCommand(name: string) {
  const r = init({ name });
  console.log(r.created ? `Made the agent's key for ${r.walletId}.` : `A key for ${r.walletId} is already saved; using it, unchanged.`);
  console.log(`  private key: ${r.path} (readable by you only; never share it or commit it)`);
  console.log(`  public key:  ${r.publicKey}`);
  console.log("");
  console.log("Open this link to create the wallet with this agent's key, or paste the public key into Add agent key on an existing wallet:");
  console.log(`  ${r.link}`);
}

async function payCommand(wallet: string, args: string[]) {
  const { values } = parseArgs({
    args,
    options: { to: { type: "string" }, amount: { type: "string" }, token: { type: "string" }, context: { type: "string" }, "context-file": { type: "string" } },
  });
  if (!values.to || !values.amount) throw new Error(`--to and --amount are required\n${USAGE}`);
  if (values.context !== undefined && values["context-file"] !== undefined) throw new Error("give --context or --context-file, not both");
  const context = values["context-file"] !== undefined ? readFileSync(values["context-file"], "utf8") : (values.context ?? "");
  const walletId = wallet.includes(".") ? wallet : `${wallet}.intented.testnet`;

  const onStep = (s: PayStep) => {
    if (s.step === "proposed") console.log(`  proposed  #${s.proposal_id}  ${tx(s.near_tx_hash)}`);
    if (s.step === "verdict") console.log(`  verdict   ${s.verdict}, signed by ${s.signer}\n            ${s.reason}`);
    if (s.step === "executed") console.log(`  execute   ${s.ok ? "ok" : "refused"}  ${tx(s.near_tx_hash)}`);
  };
  console.log(`Paying ${values.amount} ${values.token ?? "wNEAR"} to ${values.to} from ${walletId}`);
  const r = await pay({ wallet: walletId, to: values.to, amount: values.amount, ...(values.token ? { token: values.token } : {}), context, onStep });
  console.log("");
  if (r.outcome === "paid") console.log("Paid.");
  if (r.outcome === "denied") console.log("Denied. The wallet refused it on chain; nothing moved.");
  if (r.outcome === "failed") console.log(`Not paid. The verdict was ALLOW but the wallet's call failed: ${r.error}`);
  if (r.outcome === "no verdict") console.log(`No verdict: ${r.error}. Proposal #${r.proposal_id} will expire; nothing moved.`);
  if (r.outcome !== "paid") process.exitCode = 1;
}

const [command, arg, ...rest] = process.argv.slice(2);
try {
  if (command === "init" && arg) initCommand(arg);
  else if (command === "pay" && arg) await payCommand(arg, rest);
  else if (command === "mcp") await startMcpServer(version);
  else if (command === "--version" || command === "-v") console.log(version);
  else {
    console.error(USAGE);
    process.exitCode = command === "--help" || command === "-h" ? 0 : 2;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
}
