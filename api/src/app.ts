// The HTTP API (interface spec). Behaviour: decisions/2026-11-01-api-pipeline-behaviour.md.

import { createHash } from "node:crypto";
import type { Network } from "@intented/firewall-core";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { buildCrossChain } from "./crosschain.js";
import { verifySignedQuote, type CrossChainPayment, type Quote, type SignedQuote } from "./oneclick.js";
import type { RedteamLatest } from "./redteam.js";
import type { ProposalRow, Store } from "./store.js";
import { checkPropose, toAction } from "./validate.js";
import { checkExecutedRequest, checkQuoteRequest, checkVerdictRequest, MIN_LEFT_MS, QUOTE_LIMIT, VERDICT_LIMIT, type VerdictDeps, type VerdictRequest } from "./verdict.js";

/** Long enough for a real mandate, short enough that the open endpoint can't be used as storage. */
const MAX_MANDATE_CHARS = 2000;
const CONTEXT_EXCERPT_CHARS = 500;
/** Stored mandates per client and in all, per window: the owner sets one now and then. */
const MANDATE_LIMIT = { perClient: 5, total: 30, windowMs: 60_000 };
const DAY_MS = 24 * 60 * 60_000;

/**
 * Accepted requests per key over a sliding window, plus one shared count for all keys.
 * `retryAfter` is null when a request may go ahead, else the seconds until it may.
 */
function windowLimiter({ perClient, total, windowMs }: typeof MANDATE_LIMIT) {
  const byClient = new Map<string, number[]>();
  let all: number[] = [];
  const wait = (times: number[], now: number) => Math.max(1, Math.ceil((times[0]! + windowMs - now) / 1000));
  return {
    retryAfter(client: string, now: number): number | null {
      all = all.filter((t) => now - t < windowMs);
      // Only clients with requests in the window are kept, and the shared cap bounds how many those are.
      for (const [k, times] of byClient) if (times.every((t) => now - t >= windowMs)) byClient.delete(k);
      const mine = (byClient.get(client) ?? []).filter((t) => now - t < windowMs);
      if (mine.length >= perClient) return wait(mine, now);
      if (all.length >= total) return wait(all, now);
      return null;
    },
    record(client: string, now: number) {
      all.push(now);
      byClient.set(client, [...(byClient.get(client) ?? []).filter((t) => now - t < windowMs), now]);
    },
  };
}

/**
 * A stored proposal in the interface spec's Proposal shape, nothing more:
 * raw bytes, the propose hash and pipeline state stay in the database.
 */
function toProposal(p: ProposalRow, attestationUrls: Record<string, string>) {
  return {
    id: p.id,
    wallet_id: p.wallet_id,
    created_at: p.created_at,
    updated_at: p.updated_at,
    action: p.action,
    args: p.args,
    context_excerpt: p.context.slice(0, CONTEXT_EXCERPT_CHARS),
    status: p.status,
    verdict: p.verdict,
    reason: p.reason,
    model: p.model,
    chat_id: p.chat_id,
    signature: p.signature,
    signer: p.signer,
    // Null unless a verified report is published for this signer; the UI must not call it attested otherwise.
    attestation_url: (p.signer && attestationUrls[p.signer.toLowerCase()]) || null,
    ...(p.near_tx_hash ? { near_tx_hash: p.near_tx_hash } : {}),
    ...(p.oneclick ? { oneclick: p.oneclick } : {}),
  };
}

type VerdictAnswer = { status: 200 | 409 | 429 | 502; body: object; retryAfter?: number };

/** A judged proposal as POST /api/verdict returns it: the bytes base64, ready for the wallet's execute. */
function verdictBody(p: ProposalRow) {
  const b64 = (b: Uint8Array | null) => (b ? Buffer.from(b).toString("base64") : null);
  return {
    id: p.id, verdict: p.verdict, reason: p.reason, model: p.model, chat_id: p.chat_id, signer: p.signer, signature: p.signature,
    req_bytes: b64(p.req_bytes), resp_bytes: b64(p.resp_bytes),
  };
}

export interface AppDeps {
  store: Store;
  network: Network;
  model: string;
  /** Lowercase signer address to its published attestation report. */
  attestationUrls: Record<string, string>;
  /** The published red-team run, or null when none is published. */
  redteam: () => RedteamLatest | null;
  /** Origins the web app is served from (WEB_ORIGINS). */
  corsOrigins?: string[];
  /** Who sent a request, for the rate limit on POST /api/mandate. Unset, everyone shares one limit. */
  clientOf?: (c: Context) => string;
  mandateLimit?: typeof MANDATE_LIMIT;
  now?: () => number;
  /** Payments through 1Click: POST /api/quote. Unset, it answers 501. */
  crossChain?: {
    pay: (p: CrossChainPayment) => Promise<{ deposit_address: string; quote: Quote; signed_quote: SignedQuote }>;
    /** The key quotes must be signed with: 1Click's on mainnet, the stand-in's on testnet. The same key the owner registers on the wallet. */
    quoteKey: string;
  };
  /** POST /api/verdict, for wallets whose agent sends its own transactions. Unset, it answers 501. */
  verdicts?: VerdictDeps;
}

export function createApp({
  store, network, model, attestationUrls, redteam, corsOrigins = [], crossChain,
  clientOf = () => "", mandateLimit = MANDATE_LIMIT, now = Date.now, verdicts,
}: AppDeps) {
  const app = new Hono();
  const mandates = windowLimiter(mandateLimit);
  // Before the routes: Hono runs middleware in registration order.
  if (corsOrigins.length) app.use("/api/*", cors({ origin: corsOrigins }));

  // Open: storing a mandate changes nothing on-chain until the owner calls set_mandate.
  app.post("/api/mandate", async (c) => {
    const body = await c.req.json().catch(() => null);
    const text = body?.text;
    if (typeof text !== "string" || text.length === 0) return c.json({ error: "text must be a non-empty string" }, 400);
    if (text.length > MAX_MANDATE_CHARS) return c.json({ error: `text is over ${MAX_MANDATE_CHARS} characters` }, 400);
    // Hashed exactly as given, never trimmed: the wallet compares this hash byte for byte.
    const text_hash = createHash("sha256").update(text, "utf8").digest("hex");
    // Posting the same text again changes nothing, so it gets the stored mandate back and isn't counted.
    const stored = store.getMandateByHash(text_hash);
    if (stored) return c.json({ mandate_id: stored.id, text_hash });
    // Open to anyone, so limited: only stored mandates count, never refused requests.
    const client = clientOf(c);
    const retryAfter = mandates.retryAfter(client, now());
    if (retryAfter !== null) return c.json({ error: "too many mandates stored; try again later" }, 429, { "Retry-After": String(retryAfter) });
    mandates.record(client, now());
    const m = store.createMandate(text, text_hash);
    return c.json({ mandate_id: m.id, text_hash });
  });

  // Public: the text whose hash the owner set on a public contract. Callers re-hash it; the wallet enforces the hash, not this text.
  app.get("/api/mandates/:text_hash", (c) => {
    const hash = c.req.param("text_hash");
    if (!/^[0-9a-f]{64}$/.test(hash)) return c.json({ error: "text_hash must be 64 lowercase hex characters" }, 400);
    const m = store.getMandateByHash(hash);
    return m ? c.json({ mandate_id: m.id, text: m.text, text_hash: m.text_hash }) : c.json({ error: "no mandate with that hash" }, 404);
  });

  // Open, like the chain it reads: anyone may ask for the verdict on a wallet's pending proposal, and gets the
  // answer its agent would. Only the wallet's own key can execute it.
  // Requests for the same proposal at the same time share one answer, so the judge runs once.
  const judging = new Map<string, Promise<VerdictAnswer>>();
  const verdictLimit = windowLimiter(verdicts?.limit ?? VERDICT_LIMIT);
  // One count for every wallet: it bounds what NEAR AI calls cost in a day, whoever asks.
  const dailyLimit = verdicts?.dailyCap === undefined ? null : windowLimiter({ perClient: Infinity, total: verdicts.dailyCap, windowMs: DAY_MS });
  app.post("/api/verdict", async (c) => {
    if (!verdicts) return c.json({ error: "verdicts for other wallets are off on this API" }, 501);
    const req = checkVerdictRequest(await c.req.json().catch(() => null), verdicts);
    if ("error" in req) return c.json({ error: req.error }, 400);
    const key = `${req.wallet_id}:${req.proposal_id}`;
    let answer = judging.get(key);
    if (!answer) {
      answer = verdictFor(verdicts, req).finally(() => judging.delete(key));
      judging.set(key, answer);
    }
    const { status, body, retryAfter } = await answer;
    if (retryAfter) c.header("Retry-After", String(retryAfter));
    return c.json(body, status);
  });

  // A 1Click quote for a payment a wallet's agent is about to propose: the deposit address and amount to propose,
  // with the signed quote kept here, so the judge request's cross_chain is the API's own, never the agent's.
  const quoteLimit = windowLimiter(verdicts?.quoteLimit ?? QUOTE_LIMIT);
  app.post("/api/quote", async (c) => {
    if (!verdicts || !crossChain) return c.json({ error: "payments through 1Click are off on this API" }, 501);
    const req = checkQuoteRequest(await c.req.json().catch(() => null), verdicts, network);
    if ("error" in req) return c.json({ error: req.error }, 400);

    let config;
    try {
      config = await verdicts.readWallet(req.wallet_id).config();
    } catch (e) {
      return c.json({ error: `could not read ${req.wallet_id} (${(e instanceof Error ? e.message : String(e)).slice(0, 200)})` }, 502);
    }
    // Refused before a quote is spent: the wallet would refuse the payment anyway. The recipient list is not checked
    // here: a recipient off it goes to the model, and the wallet refuses it at execute.
    if (!config.cross_chain_enabled) return c.json({ error: `${req.wallet_id} has payments through 1Click switched off` }, 409);
    if (config.one_click_key !== crossChain.quoteKey) return c.json({ error: `${req.wallet_id} accepts quotes signed by another 1Click key` }, 409);

    const retryAfter = quoteLimit.retryAfter(req.wallet_id, now());
    if (retryAfter) {
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: `too many quotes; try again in ${retryAfter}s` }, 429);
    }
    quoteLimit.record(req.wallet_id, now());

    let paid;
    try {
      paid = await crossChain.pay({
        amount: req.intent.amount, origin_asset: `nep141:${req.intent.token}`, dest_asset: req.intent.dest_asset, recipient: req.intent.recipient, refund_to: req.wallet_id,
      });
    } catch (e) {
      return c.json({ error: `could not get a 1Click quote: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}` }, 502);
    }
    if (!verifySignedQuote(paid.signed_quote, crossChain.quoteKey)) return c.json({ error: "1Click's quote signature does not verify" }, 502);
    const built = buildCrossChain(req.intent, paid, { now: now(), simulated: network !== "mainnet" });
    if ("error" in built) return c.json({ error: `unusable 1Click quote: ${built.error}` }, 502);

    const q = store.createQuote(
      {
        wallet_id: req.wallet_id, token: req.intent.token, amount_in: paid.quote.amountIn, deposit_address: paid.deposit_address,
        deadline_ms: built.cross_chain.deadline_ms, cross_chain: built.cross_chain, oneclick: built.oneclick,
      },
      now(),
    );
    return c.json({ quote_id: q.id, deposit_address: q.deposit_address, token: q.token, amount_in: q.amount_in, deadline_ms: q.deadline_ms, amount_out: q.cross_chain.amount_out });
  });

  // The agent reports the execute it sent, so the receipt can link it and a 1Click deposit can be submitted.
  // The chain is the authority: the transaction must be the wallet's agent calling execute on this proposal, and have succeeded,
  // or, for a DENY, have been refused: that refusal is the receipt's proof. A DENY can never execute, so its hash is never a deposit.
  app.post("/api/executed", async (c) => {
    if (!verdicts) return c.json({ error: "verdicts for other wallets are off on this API" }, 501);
    const req = checkExecutedRequest(await c.req.json().catch(() => null), verdicts);
    if ("error" in req) return c.json({ error: req.error }, 400);
    const p = store.getProposalOnChain(req.wallet_id, req.proposal_id);
    if (!p?.verdict) return c.json({ error: `this API judged no proposal ${req.proposal_id} on ${req.wallet_id}` }, 404);

    let tx;
    try {
      const { agent_id } = await verdicts.readWallet(req.wallet_id).config();
      tx = agent_id ? await verdicts.readTx(req.near_tx_hash, agent_id) : null;
    } catch (e) {
      return c.json({ error: `could not read the chain (${(e instanceof Error ? e.message : String(e)).slice(0, 200)})` }, 502);
    }
    const call = tx?.receiver_id === req.wallet_id ? tx.calls.find((k) => k.method === "execute") : undefined;
    if (!tx) return c.json({ error: `no transaction ${req.near_tx_hash} from ${req.wallet_id}'s agent` }, 409);
    if (!call || call.args?.proposal_id !== req.proposal_id) return c.json({ error: `${req.near_tx_hash} isn't ${req.wallet_id}'s execute of proposal ${req.proposal_id}` }, 409);
    if (!tx.ok && p.verdict !== "DENY") return c.json({ error: `${req.near_tx_hash} didn't succeed` }, 409);
    store.updateProposal(p.id, { near_tx_hash: req.near_tx_hash });
    return c.json({ id: p.id });
  });

  async function verdictFor(verdicts: VerdictDeps, req: VerdictRequest): Promise<VerdictAnswer> {
    const wallet = verdicts.readWallet(req.wallet_id);

    let config, onChain;
    try {
      [config, onChain] = await Promise.all([wallet.config(), wallet.proposal(req.proposal_id)]);
    } catch (e) {
      return { status: 502, body: { error: `could not read ${req.wallet_id} (${(e instanceof Error ? e.message : String(e)).slice(0, 200)})` } };
    }
    // Judged once: the stored verdict is the answer, whatever the context says now. The nonce check skips rows
    // from an earlier deployment of the API's own wallet, whose proposal ids started again from 0.
    const stored = store.getProposalOnChain(req.wallet_id, req.proposal_id);
    if (stored?.verdict && onChain && stored.action.nonce === onChain.action.nonce) return { status: 200, body: verdictBody(stored) };

    // Refused before the NEAR AI call: each of these would make the verdict useless to execute.
    const refuse = (error: string) => ({ status: 409 as const, body: { error } });
    if (config.frozen) return refuse(`${req.wallet_id} is frozen`);
    if (config.model_id !== verdicts.expected.model) return refuse(`${req.wallet_id} accepts verdicts from model ${config.model_id ?? "(none)"}, not ${verdicts.expected.model}`);
    if (config.prompt_hash !== verdicts.expected.promptHash) return refuse(`${req.wallet_id} expects another judge prompt (hash ${config.prompt_hash ?? "(none)"})`);
    if (!config.mandate_hash) return refuse(`${req.wallet_id} has no rules set`);
    const mandate = store.getMandateByHash(config.mandate_hash);
    if (!mandate) return refuse(`this API doesn't hold the text of ${req.wallet_id}'s rules; save them with POST /api/mandate`);
    if (!onChain) return refuse(`${req.wallet_id} has no proposal ${req.proposal_id}`);
    if (onChain.status !== "pending") return refuse(`proposal ${req.proposal_id} is ${onChain.status}, not pending`);
    if (Number(onChain.action.expiry_ms) - now() < MIN_LEFT_MS) return refuse(`proposal ${req.proposal_id} expires in under a minute; propose it again`);
    const form = checkPropose({ mandate_id: mandate.id, action: onChain.action, args: onChain.args_json, context: req.context }, { network, model, now: now() });
    if ("error" in form) return refuse(`the wallet's proposal can't be judged: ${form.error}`);

    // A payment through 1Click: the proposal must be exactly what the API's own quote says, and cross_chain comes from that quote.
    const quote = req.quote_id === undefined ? undefined : store.getQuote(req.quote_id);
    if (req.quote_id !== undefined) {
      if (!quote || quote.wallet_id !== req.wallet_id) return refuse(`no quote ${req.quote_id} for ${req.wallet_id}`);
      if (quote.proposal_id) return refuse(`quote ${req.quote_id} was used for another proposal; ask for a new one`);
      if (now() >= Number(quote.deadline_ms)) return refuse(`quote ${req.quote_id} is past its deadline; ask for a new one`);
      const args = JSON.parse(form.args) as Record<string, unknown>;
      const matches = form.action.receiver_id === quote.token && form.action.method === "ft_transfer" && args.receiver_id === quote.deposit_address && args.amount === quote.amount_in;
      if (!matches) return refuse(`proposal ${req.proposal_id} isn't an ft_transfer of ${quote.amount_in} ${quote.token} to ${quote.deposit_address}, as quote ${req.quote_id} says`);
      if (BigInt(form.action.expiry_ms) >= BigInt(quote.deadline_ms)) return refuse(`proposal ${req.proposal_id} must expire before the quote's deadline, ${quote.deadline_ms}`);
    }

    // Counted per wallet, before the call: a failed judgement costs a NEAR AI call too.
    const retryAfter = verdictLimit.retryAfter(req.wallet_id, now());
    if (retryAfter) return { status: 429, body: { error: `too many verdicts for ${req.wallet_id}; try again in ${retryAfter}s` }, retryAfter };
    const dayRetryAfter = dailyLimit?.retryAfter("", now());
    if (dayRetryAfter) return { status: 429, body: { error: `this API's verdicts for the last 24 hours are used up; try again in ${dayRetryAfter}s` }, retryAfter: dayRetryAfter };
    verdictLimit.record(req.wallet_id, now());
    dailyLimit?.record("", now());

    const p = store.createProposal({
      ...form, wallet_id: req.wallet_id, chain_proposal_id: req.proposal_id, ...(quote ? { cross_chain: quote.cross_chain, oneclick: quote.oneclick } : {}),
    });
    // No await since the check above, so two requests can't both use the quote.
    if (quote) store.useQuote(quote.id, p.id);
    let v;
    try {
      v = await verdicts.judge(mandate.text, toAction(form.action), form.args, form.context, quote?.cross_chain);
    } catch (e) {
      store.updateProposal(p.id, { status: "failed", step: "done", reason: `no verdict (${(e instanceof Error ? e.message : String(e)).slice(0, 200)})` });
      if (quote) store.releaseQuote(quote.id, p.id);
      return { status: 502, body: { error: "the judge gave no verdict; try again" } };
    }
    store.updateProposal(p.id, {
      verdict: v.verdict, reason: v.reason, model: v.model, chat_id: v.chat_id, signature: v.signature, signer: v.signer,
      req_bytes: v.req_bytes, resp_bytes: v.resp_bytes, status: v.verdict === "ALLOW" ? "allowed" : "denied", step: "execute",
    });
    verdicts.settle(p.id);
    return { status: 200, body: verdictBody(store.getProposal(p.id)!) };
  }

  // Public: everything here is also on-chain. `since` is "changed after", so status changes reach the feed.
  app.get("/api/proposals", (c) => {
    const since = Number(c.req.query("since") ?? 0);
    if (!Number.isInteger(since) || since < 0) return c.json({ error: "since must be a millisecond timestamp" }, 400);
    const wallet = c.req.query("wallet");
    return c.json(store.proposalsSince(since, 100, wallet).map((p) => toProposal(p, attestationUrls)));
  });

  app.get("/api/proposals/:id", (c) => {
    const p = store.getProposal(c.req.param("id"));
    return p ? c.json(toProposal(p, attestationUrls)) : c.json({ error: "no such proposal" }, 404);
  });

  app.get("/api/redteam/latest", (c) => {
    const run = redteam();
    return run ? c.json(run) : c.json({ error: "no red-team run is published" }, 404);
  });

  return app;
}
