// The demo agent. Deliberately naive: it pays whatever the paywall's 402 asks,
// to whoever it names, and leaves the judgement to Intented. One run is one
// purchase: fetch, propose the payment, wait for the wallet, retry with proof.

import { createHash } from "node:crypto";
import { encode, type PaymentPayload, type PaymentRequired } from "./x402.js";

export interface AgentConfig {
  apiUrl: string;
  apiToken: string;
  agentId: string; // the account that signs execute, named in the payment proof
  mandate: string; // the wallet's mandate text, byte for byte
  log: (line: string) => void;
  pollMs?: number;
  timeoutMs?: number;
}

export interface AgentResult {
  proposal_id: string;
  status: string;
  verdict: string | null;
  reason: string | null;
  near_tx_hash: string | null;
  data: unknown | null; // what the paywall served, if it was paid
}

interface Proposal {
  status: string;
  verdict: string | null;
  reason: string | null;
  near_tx_hash?: string;
}

const EXPIRY_MS = 15 * 60_000;
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export async function runAgent(url: string, cfg: AgentConfig): Promise<AgentResult> {
  const { log } = cfg;
  const pollMs = cfg.pollMs ?? 1000;
  const timeoutMs = cfg.timeoutMs ?? 180_000;

  log(`GET ${url}`);
  const first = await fetch(url);
  if (first.status !== 402) throw new Error(`expected 402 from the paywall, got ${first.status}`);
  const quoted = await first.text(); // the 402 body goes to the judge as quoted data, unparsed
  const terms = JSON.parse(quoted) as PaymentRequired;
  const asked = terms.accepts[0];
  if (!asked) throw new Error("the 402 lists no payment option");
  log(`402: pay ${asked.amount} of ${asked.asset} to ${asked.payTo}`);
  log(`402 says: "${terms.resource.description}"`);

  const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${cfg.apiUrl}${path}`, init);
    const body = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(`${path}: ${res.status} ${body.error ?? ""}`);
    return body;
  };
  const post = <T>(path: string, body: unknown) =>
    api<T>(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiToken}` },
      body: JSON.stringify(body),
    });

  const { mandate_id } = await post<{ mandate_id: string }>("/api/mandate", { text: cfg.mandate });

  const args = JSON.stringify({ receiver_id: asked.payTo, amount: asked.amount, memo: "market data" });
  const now = Date.now();
  const action = {
    receiver_id: asked.asset,
    method: "ft_transfer",
    args_sha256: sha256(args),
    deposit: "1",
    nonce: String(now),
    expiry_ms: String(now + EXPIRY_MS),
  };
  const { proposal_id } = await post<{ proposal_id: string }>("/api/propose", { mandate_id, action, args, context: quoted });
  log(`proposed ${proposal_id}; waiting for the verdict and the wallet`);

  // Done once the wallet has answered (a hash to link) or the pipeline gave up.
  const started = Date.now();
  let p: Proposal;
  for (;;) {
    p = await api<Proposal>(`/api/proposals/${proposal_id}`);
    if (p.status === "failed" || ((p.status === "executed" || p.status === "denied") && p.near_tx_hash)) break;
    if (Date.now() - started > timeoutMs) throw new Error(`${proposal_id} still ${p.status} after ${timeoutMs / 1000} s`);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  log(`${p.status}: verdict ${p.verdict ?? "none"}, ${p.reason ?? ""}`);
  if (p.near_tx_hash) log(`wallet tx ${p.near_tx_hash}`);

  const result: AgentResult = {
    proposal_id,
    status: p.status,
    verdict: p.verdict,
    reason: p.reason,
    near_tx_hash: p.near_tx_hash ?? null,
    data: null,
  };
  if (p.status !== "executed" || !p.near_tx_hash) return result;

  const proof: PaymentPayload = { x402Version: 2, accepted: asked, payload: { transaction: p.near_tx_hash, signer: cfg.agentId } };
  log(`GET ${url} with PAYMENT-SIGNATURE`);
  const paid = await fetch(url, { headers: { "PAYMENT-SIGNATURE": encode(proof) } });
  if (paid.status !== 200) throw new Error(`the paywall refused the payment: ${paid.status} ${await paid.text()}`);
  result.data = await paid.json();
  log(`200: ${JSON.stringify(result.data)}`);
  return result;
}
