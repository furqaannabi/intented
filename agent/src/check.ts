// Checks a wallet's execute transaction from the chain alone (src/check-tx.ts), for anyone, with no .env.
//
// Usage: pnpm check-tx <wallet> <execute tx hash>
//   e.g. pnpm check-tx retest-1105.intented.testnet AHCrqfxh7D6Y9Tkineih2z3W4zM6TAUuPU54TjAGP6om
// The network follows the wallet's name (.near is mainnet); NEAR_RPC_URL, if set, overrides the public RPC.

import { checkExecute, type RpcTx, type WalletConfig } from "./check-tx.js";

const [wallet, hash] = process.argv.slice(2);
if (!wallet || !hash) {
  console.error("usage: pnpm check-tx <wallet> <execute tx hash>");
  process.exit(2);
}
const mainnet = wallet.endsWith(".near");
const rpcUrl = process.env.NEAR_RPC_URL || (mainnet ? "https://archival-rpc.mainnet.fastnear.com" : "https://archival-rpc.testnet.fastnear.com");
const explorer = mainnet ? "https://nearblocks.io" : "https://testnet.nearblocks.io";

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "check", method, params }) });
  const body = (await res.json()) as { result?: T; error?: { message?: string; data?: unknown } };
  if (!body.result) throw new Error(`${method}: ${body.error?.message ?? res.status} ${JSON.stringify(body.error?.data ?? "")}`);
  return body.result;
}

const view = await rpc<{ result: number[] }>("query", {
  request_type: "call_function", finality: "final", account_id: wallet, method_name: "get_config", args_base64: Buffer.from("{}").toString("base64"),
});
const config = JSON.parse(Buffer.from(view.result).toString("utf8")) as WalletConfig & { agent_id: string };
// Only the wallet's agent sends execute, so it is the transaction's signer.
const tx = await rpc<RpcTx>("tx", { tx_hash: hash, sender_account_id: config.agent_id, wait_until: "FINAL" });
const r = checkExecute(tx, config);

console.log(`${explorer}/txns/${hash}`);
console.log(`signed text  ${r.signedText}`);
console.log(`signer       ${r.signer} (${r.allowlisted ? "on" : "NOT on"} ${wallet}'s allowlist: ${config.signers.join(", ")})`);
console.log(`verdict      ${r.verdict}: ${r.reason}`);
console.log(`execute      ${r.outcome.ok ? "succeeded" : `refused: ${r.outcome.error}`}`);
for (const t of r.transfers) console.log(`transfer     ${t.amount} of ${t.token}, ${t.from} → ${t.to}`);
if (r.transfers.length === 0) console.log("transfer     none");
