// What each MCP tool does, apart from the MCP wiring in server.ts, so it can be tested on its own.
// Each returns plain text for the coding agent to read. None ever returns a private key.

import { FACTORY_ID, initAgent, loadAgentKey, type AgentKey } from "@intented/agent/src/init.js";
import { pay, toYocto, type PayDeps } from "@intented/agent/src/pay.js";
import { walletAgent } from "@intented/agent/src/wallet.js";

const explorer = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;

export interface InitDeps {
  /** Where keys are kept: ~/.intented by default, as for `pnpm intented`. */
  home: string;
  /** The web app the Create link opens. */
  webUrl: string;
}

/** intented_init: the agent's key for <name>.intented.testnet, made on this machine, and the link that creates the wallet. */
export function initTool({ name }: { name: string }, { home, webUrl }: InitDeps): string {
  const r = initAgent({ name, home, webUrl });
  return [
    r.created ? `Made the agent's key for ${r.walletId}.` : `A key for ${r.walletId} is already saved; using it, unchanged.`,
    `Public key: ${r.publicKey}`,
    `The private key stays in ${r.path}, readable by this user only.`,
    "",
    "Ask the wallet's owner to open this link, write the rules, and sign. It creates the wallet with this agent's key:",
    r.link,
    "For a wallet that already exists, the owner adds the public key with Add agent key on the wallet page instead.",
  ].join("\n");
}

export interface PayToolDeps {
  home: string;
  /** The Intented API that judges the proposal. */
  apiUrl: string;
  rpcUrl: string;
  fetch?: typeof fetch;
  /** The agent that signs propose and execute; walletAgent with the saved key unless a test gives one. */
  makeAgent?: (key: AgentKey) => PayDeps["agent"];
}

/**
 * intented_pay: proposes a wNEAR payment on the agent's wallet, gets the signed verdict on exactly that proposal, and
 * hands it to the wallet, which pays only on a valid ALLOW within its caps. `context` is what the agent read that led
 * to the payment; the judge reads it as data, never as instructions.
 */
export async function payTool(
  { name, to, amount, context }: { name: string; to: string; amount: string; context: string },
  { home, apiUrl, rpcUrl, fetch: f, makeAgent = (key) => walletAgent({ key, rpcUrl }) }: PayToolDeps,
): Promise<string> {
  const payment = { token: "wrap.testnet", to, amount: toYocto(amount) };
  const key = loadAgentKey({ walletId: `${name}.${FACTORY_ID}`, home });
  const r = await pay({ walletId: key.walletId, payment, context, agent: makeAgent(key), apiUrl: apiUrl.replace(/\/+$/, ""), ...(f ? { fetch: f } : {}) });
  const what = `${amount} wNEAR to ${to} from ${key.walletId}`;

  switch (r.outcome) {
    case "paid":
      return [`Paid ${what}.`, `Verdict: ALLOW. ${r.reason}`, `Transaction: ${explorer(r.execute_tx)}`].join("\n");
    case "denied":
      return [
        `Denied: ${what}. The wallet refused it on chain; nothing moved.`,
        `Verdict: DENY. ${r.reason}`,
        `Refused transaction: ${explorer(r.execute_tx)}`,
        "The owner's rules don't allow this payment. Do not retry it or reword it; tell the user what was asked and why it was refused.",
      ].join("\n");
    case "failed":
      return [`Not paid: ${what}. The verdict was ALLOW, but the wallet's call failed; nothing moved.`, r.error, `Transaction: ${explorer(r.execute_tx)}`].join("\n");
    case "no verdict":
      return [`Not paid: ${what}. No verdict (${r.error}), so nothing moved; proposal #${r.proposal_id} will expire.`].join("\n");
  }
}

/** "10000000000000000000000" → "0.01". Exact, like toYocto. */
function fromYocto(yocto: string): string {
  const v = BigInt(yocto);
  const whole = v / 10n ** 24n;
  const frac = (v % 10n ** 24n).toString().padStart(24, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** A read-only view call on a NEAR contract. */
async function view<T>(f: typeof fetch, rpcUrl: string, accountId: string, method: string, args: object): Promise<T> {
  const res = await f(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "final", account_id: accountId, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }),
  });
  const body = (await res.json()) as { result?: { result?: number[] }; error?: { message?: string } };
  if (!body.result?.result) throw new Error(`${accountId}.${method}: ${body.error?.message ?? "no result"}; is ${accountId} a wallet?`);
  return JSON.parse(Buffer.from(body.result.result).toString("utf8")) as T;
}

interface ApiProposal { created_at: string; status: string; verdict?: string; reason?: string; args?: { receiver_id?: string; amount?: string } }

/** intented_status: the wallet's live rules and its last payments, read from the chain and the API. Read-only. */
export async function statusTool({ name }: { name: string }, { apiUrl, rpcUrl, fetch: f = fetch }: { apiUrl: string; rpcUrl: string; fetch?: typeof fetch }): Promise<string> {
  const walletId = `${name}.${FACTORY_ID}`;
  const api = apiUrl.replace(/\/+$/, "");
  const config = await view<{ frozen: boolean; mandate_hash: string | null }>(f, rpcUrl, walletId, "get_config", {});
  const token = await view<{ caps: { per_tx: string; daily: string } } | null>(f, rpcUrl, walletId, "get_token", { token_id: "wrap.testnet" });

  let rules = "The wallet has no rules set, so it refuses every payment.";
  if (config.mandate_hash) {
    const res = await f(`${api}/api/mandates/${config.mandate_hash}`).catch(() => null);
    const m = res?.ok ? ((await res.json()) as { text?: string }) : null;
    rules = m?.text ? `The owner's rules:\n${m.text}` : `The owner's rules hash to ${config.mandate_hash}, but the API at ${api} doesn't have their text.`;
  }

  const res = await f(`${api}/api/proposals?wallet=${encodeURIComponent(walletId)}`).catch(() => null);
  const recent = res?.ok ? ((await res.json()) as ApiProposal[]).slice(0, 5) : null;
  const lines = recent?.map((p) => {
    const amount = p.args?.amount ? `${fromYocto(p.args.amount)} wNEAR` : "?";
    return `- ${p.created_at}: ${amount} to ${p.args?.receiver_id ?? "?"}, ${p.verdict ?? "no verdict"} (${p.status})${p.reason ? `: ${p.reason}` : ""}`;
  });

  return [
    `Wallet ${walletId}`,
    `Frozen: ${config.frozen ? "yes; it refuses every payment until the owner unfreezes it" : "no"}`,
    token ? `wNEAR caps: ${fromYocto(token.caps.per_tx)} wNEAR per payment, ${fromYocto(token.caps.daily)} wNEAR per day` : "wNEAR: not enabled on this wallet",
    rules,
    "",
    recent === null ? `Recent payments: the API at ${api} didn't answer.` : lines!.length ? `Recent payments, newest first:\n${lines!.join("\n")}` : "No payments yet.",
  ].join("\n");
}
