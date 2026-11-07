// The `intented` library: make an agent's key, and pay from its Intented wallet.
//
// A payment is proposed on the wallet with the agent's own key, judged by the Intented API (a model in a TEE checks it
// against the owner's rules and signs the verdict), and handed to the wallet, which pays only on a valid signed ALLOW
// within its caps. NEAR testnet only, for now.
//
// The working parts are the demo agent's (agent/src) and the firewall core's token table, bundled into this package.

import { homedir } from "node:os";
import { join } from "node:path";
import { initAgent, loadAgentKey, type InitResult } from "@intented/agent/src/init.js";
import { pay as payWith, type PayDeps, type PayResult, type PayStep } from "@intented/agent/src/pay.js";
import { walletAgent } from "@intented/agent/src/wallet.js";
import { KNOWN_TOKENS } from "../../firewall-core/src/tokens.js";

export type { InitResult, PayResult, PayStep };

/** Where things are, unless a call says otherwise. Environment variables override the built-in defaults. */
export const defaults = {
  apiUrl: process.env.INTENTED_API_URL || "http://localhost:8787",
  webUrl: process.env.INTENTED_WEB_URL || "http://localhost:3000",
  rpcUrl: process.env.NEAR_RPC_URL || "https://rpc.testnet.near.org",
  home: process.env.INTENTED_HOME || join(homedir(), ".intented"),
};

/** "2.5" with 6 decimals → "2500000". Exact: no floating point anywhere. */
export function toUnits(amount: string, decimals: number): string {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!m) throw new Error(`amount must be a plain number, like 0.001 (got ${JSON.stringify(amount)})`);
  const frac = m[2] ?? "";
  if (frac.length > decimals) throw new Error(`amount ${amount} has more than this token's ${decimals} decimals`);
  const units = BigInt(m[1]!) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  if (units === 0n) throw new Error("amount must be more than 0");
  return units.toString();
}

/**
 * Makes the agent's key for <name>.intented.testnet on this machine, unless one is saved already, and returns its
 * public key and the link that creates the wallet. The private key stays in a file only this user can read.
 */
export function init({ name, home = defaults.home, webUrl = defaults.webUrl }: { name: string; home?: string; webUrl?: string }): InitResult {
  return initAgent({ name, home, webUrl: webUrl.replace(/\/+$/, "") });
}

export interface PayOptions {
  /** The agent's wallet, e.g. my-agent.intented.testnet. Its key must be saved by `init`. */
  wallet: string;
  /** The NEAR account to pay. */
  to: string;
  /** How much, in whole tokens, e.g. "0.001". */
  amount: string;
  /** The token contract; wNEAR (wrap.testnet) by default. Only tokens the firewall core knows. */
  token?: string;
  /** What the agent read that led to this payment, verbatim, e.g. the HTTP 402 reply. The judge reads it as data. */
  context: string;
  apiUrl?: string;
  rpcUrl?: string;
  home?: string;
  /** Called as each step happens: proposed, verdict, executed, reported. */
  onStep?: (s: PayStep) => void;
}

/**
 * Proposes the payment on the wallet, gets the signed verdict on exactly that proposal, and hands it to the wallet.
 * The wallet pays only on a valid ALLOW within its caps; a DENY is refused on chain and nothing moves.
 */
export async function pay(o: PayOptions, deps: { agent?: PayDeps["agent"]; fetch?: typeof fetch } = {}): Promise<PayResult> {
  if (!o.wallet.endsWith(".testnet")) throw new Error(`${o.wallet}: this package pays on NEAR testnet only, for now`);
  const tokenId = o.token ?? "wrap.testnet";
  const token = KNOWN_TOKENS.testnet.find((t) => t.contract === tokenId);
  if (!token) throw new Error(`${tokenId} isn't a token the firewall knows on testnet: ${KNOWN_TOKENS.testnet.map((t) => `${t.symbol} (${t.contract})`).join(", ")}`);
  const payment = { token: tokenId, to: o.to, amount: toUnits(o.amount, token.decimals) };

  const rpcUrl = o.rpcUrl ?? defaults.rpcUrl;
  const agent = deps.agent ?? walletAgent({ key: loadAgentKey({ walletId: o.wallet, home: o.home ?? defaults.home }), rpcUrl });
  return payWith({
    walletId: o.wallet,
    payment,
    context: o.context,
    agent,
    apiUrl: (o.apiUrl ?? defaults.apiUrl).replace(/\/+$/, ""),
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(o.onStep ? { onStep: o.onStep } : {}),
  });
}
