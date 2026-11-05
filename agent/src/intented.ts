// The agent's command line.
//
// Usage: pnpm intented init <name>
//   Makes the agent's key pair for <name>.intented.testnet, saves it in ~/.intented/testnet/,
//   and prints the Create page link that registers its public half. It never prints the private key.
//   INTENTED_HOME and INTENTED_WEB_URL override where keys are kept and which web app the link opens.
//
// Usage: pnpm intented pay <name> --to <account> --amount <wNEAR> [--context <text> | --context-file <path>] [--token <contract>]
//   Proposes the payment on <name>.intented.testnet with the saved key, asks the API for the verdict, and hands it to
//   the wallet, which pays only on a valid ALLOW within its caps. INTENTED_API_URL and NEAR_RPC_URL override the defaults.
//   Colours are left out when the output isn't a terminal, or NO_COLOR is set.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs, styleText } from "node:util";
import { FACTORY_ID, initAgent, loadAgentKey } from "./init.js";
import { pay, toYocto, type PayStep } from "./pay.js";
import { walletAgent } from "./wallet.js";

const USAGE = `usage:
  pnpm intented init <name>
  pnpm intented pay <name> --to <account> --amount <wNEAR> [--context <text> | --context-file <path>] [--token <contract>]`;

type Style = Parameters<typeof styleText>[0];
const paint = (style: Style, text: string) => styleText(style, text, { stream: process.stdout });
const txLink = (hash: string) => paint("dim", `https://testnet.nearblocks.io/txns/${hash}`);
const home = process.env.INTENTED_HOME || join(homedir(), ".intented");

function init(name: string) {
  const r = initAgent({ name, home, webUrl: (process.env.INTENTED_WEB_URL || "http://localhost:3000").replace(/\/+$/, "") });
  console.log(r.created ? paint("green", `Made the agent's key for ${r.walletId}.`) : `A key for ${r.walletId} is already saved; using it, unchanged.`);
  console.log(`  private key: ${r.path} ${paint("dim", "(readable by you only; never share it or commit it)")}`);
  console.log(`  public key:  ${paint("bold", r.publicKey)}`);
  console.log("");
  console.log("Open this link to create the wallet with this agent's key, or paste the public key into Add agent key on an existing wallet:");
  console.log(`  ${paint("cyan", r.link)}`);
}

async function payCommand(name: string, args: string[]) {
  const { values } = parseArgs({
    args,
    options: { to: { type: "string" }, amount: { type: "string" }, token: { type: "string", default: "wrap.testnet" }, context: { type: "string" }, "context-file": { type: "string" } },
  });
  if (!values.to || !values.amount) throw new Error(`--to and --amount are required\n${USAGE}`);
  if (values.context !== undefined && values["context-file"] !== undefined) throw new Error("give --context or --context-file, not both");
  const context = values["context-file"] !== undefined ? readFileSync(values["context-file"], "utf8") : (values.context ?? "");
  const payment = { token: values.token, to: values.to, amount: toYocto(values.amount) };

  const key = loadAgentKey({ walletId: `${name}.${FACTORY_ID}`, home });
  const agent = walletAgent({ key, rpcUrl: process.env.NEAR_RPC_URL || "https://rpc.testnet.near.org" });
  console.log(`Paying ${paint("bold", `${values.amount} wNEAR`)} to ${paint("bold", values.to)} from ${key.walletId}`);

  const label = (s: string) => paint("dim", s.padEnd(9));
  const onStep = (s: PayStep) => {
    if (s.step === "proposed") console.log(`  ${label("proposed")}#${s.proposal_id}  ${txLink(s.near_tx_hash)}`);
    if (s.step === "verdict") {
      console.log(`  ${label("verdict")}${s.verdict === "ALLOW" ? paint(["bold", "green"], "ALLOW") : paint(["bold", "red"], "DENY")}  ${paint("dim", `signed by ${s.signer}`)}`);
      console.log(`  ${label("")}${s.reason}`);
    }
    if (s.step === "executed") console.log(`  ${label("execute")}${s.ok ? paint("green", "ok") : paint("yellow", "refused")}  ${txLink(s.near_tx_hash)}`);
  };

  const r = await pay({ walletId: key.walletId, payment, context, agent, apiUrl: (process.env.INTENTED_API_URL || "http://localhost:8787").replace(/\/+$/, ""), onStep });
  console.log("");
  if (r.outcome === "paid") console.log(paint(["bold", "green"], "Paid."));
  if (r.outcome === "denied") console.log(`${paint(["bold", "red"], "Denied.")} The wallet refused it on chain; nothing moved.`);
  if (r.outcome === "failed") console.log(`${paint(["bold", "yellow"], "Not paid.")} The verdict was ALLOW but the wallet's call failed: ${r.error}`);
  if (r.outcome === "no verdict") console.log(`${paint(["bold", "yellow"], "No verdict:")} ${r.error}. Proposal #${r.proposal_id} will expire; nothing moved.`);
  if (r.outcome !== "paid") process.exitCode = 1;
}

const [command, name, ...rest] = process.argv.slice(2);
try {
  if (command === "init" && name) init(name);
  else if (command === "pay" && name) await payCommand(name, rest);
  else {
    console.error(USAGE);
    process.exit(2);
  }
} catch (e) {
  console.error(styleText("red", e instanceof Error ? e.message : String(e), { stream: process.stderr }));
  process.exit(1);
}
