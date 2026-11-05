// The demo agent. Deliberately naive: it pays whatever the paywall's 402 asks,
// to whoever it names, and leaves the judgement to Intented. One run is one
// purchase: fetch, propose the payment on the wallet with its own key, get the
// verdict from the API, hand it to the wallet, retry the paywall with proof.
// A 402 on Base is paid through 1Click: the API quotes it first, and the agent
// proposes exactly the quoted transfer, then waits for delivery.

import { createHash } from "node:crypto";
import { BASE_USDC_CONTRACT } from "./base.js";
import { BASE_USDC } from "./oneclick-standin.js";
import { pay, type PayDeps, type PayStep } from "./pay.js";
import type { Payment } from "./wallet.js";
import { encode, type PaymentPayload, type PaymentRequired, type Requirement } from "./x402.js";

export interface AgentConfig {
  apiUrl: string;
  /** The wallet it pays from, and the account whose key signs propose and execute, named in the payment proof. */
  walletId: string;
  agentId: string;
  /** Sends propose and execute with the agent's own key (wallet.ts's walletAgent). */
  agent: PayDeps["agent"];
  /** The wallet's mandate_hash, read from the contract: the agent proposes under whatever rules are live. */
  mandateHash: string;
  /** A text to store if the API has none for that hash yet (a fresh database); used only if it hashes to it. */
  seedMandate?: string;
  log: (line: string) => void;
  pollMs?: number;
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
  oneclick?: OneClick;
}

/** What POST /api/quote answers: the transfer to propose. */
interface Quote {
  quote_id: string;
  deposit_address: string;
  token: string;
  amount_in: string;
  deadline_ms: string;
  amount_out: string;
}

const EXPIRY_MS = 15 * 60_000;
/** A payment through 1Click expires this long before its quote, so 1Click is still taking deposits when it lands. */
const DEADLINE_MARGIN_MS = 5 * 60_000;
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

/** What the recipient gets on Base, for POST /api/quote. */
function crossChainIntent(asked: Requirement, payWith: string) {
  if (asked.asset.toLowerCase() !== BASE_USDC_CONTRACT) throw new Error(`the agent pays USDC on Base only, not ${asked.asset}`);
  return { token: payWith, amount: asked.amount, dest_chain: "base", dest_asset: BASE_USDC, recipient: asked.payTo };
}

export async function runAgent(url: string, cfg: AgentConfig): Promise<AgentResult> {
  const { log } = cfg;
  const pollMs = cfg.pollMs ?? 1000;

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
  const post = <T>(path: string, body: unknown, extra: Record<string, string> = {}) =>
    api<T>(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...extra },
      body: JSON.stringify(body),
    });

  // The API judges only under rules whose text it holds; this stores them if a fresh database has none.
  await activeMandate(cfg, api, post);

  let payment: Payment;
  let quoteId: string | undefined;
  if (asked.network === BASE_NETWORK) {
    let q: Quote;
    try {
      q = await post<Quote>("/api/quote", { wallet_id: cfg.walletId, intent: crossChainIntent(asked, cfg.payWith ?? "wrap.testnet") });
    } catch (e) {
      // Refused before anything was proposed: nothing was signed and nothing can move.
      const reason = e instanceof Error ? e.message : String(e);
      log(`no quote: ${reason}`);
      return { proposal_id: "", status: "failed", verdict: null, reason, near_tx_hash: null, oneclick: null, data: null };
    }
    log(`1Click quote ${q.quote_id}: ${q.amount_in} of ${q.token} to ${q.deposit_address}, for ${q.amount_out}`);
    const now = Date.now();
    payment = { token: q.token, to: q.deposit_address, amount: q.amount_in, expiresAt: Math.min(now + EXPIRY_MS, Number(q.deadline_ms) - DEADLINE_MARGIN_MS) };
    quoteId = q.quote_id;
  } else {
    payment = { token: asked.asset, to: asked.payTo, amount: asked.amount, memo: "market data" };
  }

  const onStep = (s: PayStep) => {
    if (s.step === "proposed") log(`proposed ${s.proposal_id} on ${cfg.walletId}, tx ${s.near_tx_hash}`);
    if (s.step === "verdict") log(`verdict ${s.verdict}: ${s.reason}`);
    if (s.step === "executed") log(`execute tx ${s.near_tx_hash}${s.ok ? "" : `, refused: ${s.error ?? ""}`}`);
    if (s.step === "reported" && !s.ok) log(`couldn't report the execute to the API: ${s.error}`);
  };
  const r = await pay({ walletId: cfg.walletId, payment, context: quoted, agent: cfg.agent, apiUrl: cfg.apiUrl, quoteId, onStep });
  if (r.outcome === "no verdict") {
    log(`no verdict: ${r.error}`);
    return { proposal_id: "", status: "failed", verdict: null, reason: r.error, near_tx_hash: null, oneclick: null, data: null };
  }

  const result: AgentResult = {
    proposal_id: r.id,
    status: r.outcome === "paid" ? "executed" : r.outcome,
    verdict: r.outcome === "denied" ? "DENY" : "ALLOW",
    reason: r.reason,
    near_tx_hash: r.execute_tx,
    oneclick: null,
    data: null,
  };
  if (r.outcome !== "paid") return result;
  const p = { near_tx_hash: r.execute_tx, oneclick: quoteId ? (await api<Proposal>(`/api/proposals/${r.id}`)).oneclick : undefined };
  const proposal_id = r.id;

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
