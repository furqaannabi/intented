// The demo agent. Deliberately naive: it pays whatever the paywall's 402 asks,
// to whoever it names, and leaves the judgement to Intented. One run is one
// purchase: fetch, propose the payment, wait for the wallet, retry with proof.
// A 402 on Base is paid through 1Click: the agent states the payment, the API
// quotes it, and the agent waits for delivery before retrying.

import { createHash } from "node:crypto";
import { BASE_USDC_CONTRACT } from "./base.js";
import { BASE_USDC } from "./oneclick-standin.js";
import { encode, type PaymentPayload, type PaymentRequired, type Requirement } from "./x402.js";

export interface AgentConfig {
  apiUrl: string;
  apiToken: string;
  agentId: string; // the account that signs execute, named in the payment proof
  /** The wallet's mandate_hash, read from the contract: the agent proposes under whatever rules are live. */
  mandateHash: string;
  /** A text to store if the API has none for that hash yet (a fresh database); used only if it hashes to it. */
  seedMandate?: string;
  log: (line: string) => void;
  pollMs?: number;
  timeoutMs?: number;
  /** The NEAR token a payment through 1Click is paid with. Default wrap.testnet. */
  payWith?: string;
  /** How long to wait for 1Click to deliver after the wallet has paid. Default 10 minutes. */
  deliveryTimeoutMs?: number;
}

/** A payment through 1Click, as the API shows it on the proposal. */
export interface OneClick {
  deposit_address: string;
  dest_chain: string;
  recipient: string;
  amount_out: string;
  status: string;
  dest_tx_hash?: string;
  simulated: boolean;
}

export interface AgentResult {
  proposal_id: string;
  status: string;
  verdict: string | null;
  reason: string | null;
  near_tx_hash: string | null;
  oneclick: OneClick | null;
  data: unknown | null; // what the paywall served, if it was paid
}

interface Proposal {
  status: string;
  verdict: string | null;
  reason: string | null;
  near_tx_hash?: string;
  oneclick?: OneClick;
}

const EXPIRY_MS = 15 * 60_000;
const BASE_NETWORK = "eip155:8453";
const ONECLICK_FINAL = ["SUCCESS", "REFUNDED", "FAILED"];
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * The stored mandate whose text hashes to the wallet's mandate_hash. The hash is checked here too:
 * proposing under any other text only earns a verdict the wallet refuses.
 */
async function activeMandate(
  cfg: AgentConfig,
  api: <T>(path: string, init?: RequestInit) => Promise<T>,
  post: <T>(path: string, body: unknown) => Promise<T>,
): Promise<string> {
  const found = await api<{ mandate_id: string; text: string }>(`/api/mandates/${cfg.mandateHash}`).catch((e: Error) => {
    if (e.message.includes(" 404 ")) return null;
    throw e;
  });
  if (found) {
    if (sha256(found.text) !== cfg.mandateHash) throw new Error("the API's mandate text doesn't hash to the wallet's mandate_hash");
    cfg.log(`rules: "${found.text}"`);
    return found.mandate_id;
  }
  if (cfg.seedMandate !== undefined && sha256(cfg.seedMandate) === cfg.mandateHash) {
    cfg.log("rules: not stored yet; storing the known text that matches the wallet");
    return (await post<{ mandate_id: string }>("/api/mandate", { text: cfg.seedMandate })).mandate_id;
  }
  throw new Error(`no stored mandate has the wallet's hash ${cfg.mandateHash}; set the rules from the rules page`);
}

/** The second propose body: what the recipient gets on Base. The API quotes it and builds the transfer. */
function crossChainBody(asked: Requirement, payWith: string) {
  if (asked.asset.toLowerCase() !== BASE_USDC_CONTRACT) throw new Error(`the agent pays USDC on Base only, not ${asked.asset}`);
  return { token: payWith, amount: asked.amount, dest_chain: "base", dest_asset: BASE_USDC, recipient: asked.payTo };
}

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

  const mandate_id = await activeMandate(cfg, api, post);

  let body: object;
  if (asked.network === BASE_NETWORK) {
    body = { mandate_id, cross_chain: crossChainBody(asked, cfg.payWith ?? "wrap.testnet"), context: quoted };
  } else {
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
    body = { mandate_id, action, args, context: quoted };
  }
  const { proposal_id } = await post<{ proposal_id: string }>("/api/propose", body);
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
    oneclick: p.oneclick ?? null,
    data: null,
  };
  if (p.status !== "executed" || !p.near_tx_hash) return result;

  let payload: PaymentPayload["payload"] = { transaction: p.near_tx_hash, signer: cfg.agentId };
  if (p.oneclick) {
    // The wallet paid the deposit address; the vendor is paid once 1Click delivers.
    let oc = p.oneclick;
    log(`1Click: ${oc.amount_out} to ${oc.recipient} on ${oc.dest_chain}${oc.simulated ? " (simulated)" : ""}; waiting for delivery`);
    const deliveryTimeoutMs = cfg.deliveryTimeoutMs ?? 10 * 60_000;
    const waiting = Date.now();
    while (!ONECLICK_FINAL.includes(oc.status)) {
      if (Date.now() - waiting > deliveryTimeoutMs) throw new Error(`${proposal_id}: 1Click still ${oc.status} after ${deliveryTimeoutMs / 1000} s`);
      await new Promise((r) => setTimeout(r, pollMs));
      oc = (await api<Proposal>(`/api/proposals/${proposal_id}`)).oneclick!;
    }
    result.oneclick = oc;
    log(`1Click: ${oc.status}${oc.dest_tx_hash ? `, destination tx ${oc.dest_tx_hash}` : ""}`);
    if (oc.status !== "SUCCESS") return result;
    // Simulated, nothing reached Base: the paywall checks the deposit with the stand-in. Otherwise it reads the Base transaction.
    if (oc.simulated) payload = { transaction: p.near_tx_hash, deposit_address: oc.deposit_address };
    else if (oc.dest_tx_hash) payload = { transaction: oc.dest_tx_hash };
    else throw new Error(`${proposal_id}: 1Click reports SUCCESS without a destination transaction`);
  }

  const proof: PaymentPayload = { x402Version: 2, accepted: asked, payload };
  log(`GET ${url} with PAYMENT-SIGNATURE`);
  const paid = await fetch(url, { headers: { "PAYMENT-SIGNATURE": encode(proof) } });
  if (paid.status !== 200) throw new Error(`the paywall refused the payment: ${paid.status} ${await paid.text()}`);
  result.data = await paid.json();
  log(`200: ${JSON.stringify(result.data)}`);
  return result;
}
