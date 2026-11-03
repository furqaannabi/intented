// The HTTP API (interface spec). Behaviour: decisions/2026-11-01-api-pipeline-behaviour.md.

import { createHash, timingSafeEqual } from "node:crypto";
import type { Network } from "@intented/firewall-core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildCrossChain, checkCrossChainPropose } from "./crosschain.js";
import type { CrossChainPayment, Quote } from "./oneclick.js";
import type { RedteamLatest } from "./redteam.js";
import type { ProposalRow, Store } from "./store.js";
import { checkPropose } from "./validate.js";

/** Long enough for a real mandate, short enough that the open endpoint can't be used as storage. */
const MAX_MANDATE_CHARS = 2000;
const CONTEXT_EXCERPT_CHARS = 500;

/**
 * A stored proposal in the interface spec's Proposal shape, nothing more:
 * raw bytes, the propose hash and pipeline state stay in the database.
 */
function toProposal(p: ProposalRow, attestationUrls: Record<string, string>) {
  return {
    id: p.id,
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

export interface AppDeps {
  store: Store;
  network: Network;
  model: string;
  /** The agent's bearer token for POST /api/propose. Unset, the endpoint refuses everyone. */
  agentToken: string | undefined;
  /** Starts the pipeline for a stored proposal; returns at once. */
  startPipeline: (proposalId: string) => void;
  /** Lowercase signer address to its published attestation report. */
  attestationUrls: Record<string, string>;
  /** The published red-team run, or null when none is published. */
  redteam: () => RedteamLatest | null;
  /** Origins the web app is served from (WEB_ORIGINS). */
  corsOrigins?: string[];
  /**
   * Payments through 1Click. Unset, a cross-chain propose is refused: set it only
   * once the firewall core's judge() puts `cross_chain` in the request, so the
   * judge sees the real recipient.
   */
  crossChain?: {
    pay: (p: CrossChainPayment) => Promise<{ deposit_address: string; quote: Quote }>;
    /** The wallet: 1Click refunds a failed swap here. */
    refundTo: string;
  };
}

/** Constant-time, so the token can't be guessed byte by byte from response times. */
function tokenMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function createApp({ store, network, model, agentToken, startPipeline, attestationUrls, redteam, corsOrigins = [], crossChain }: AppDeps) {
  const app = new Hono();
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

  // The agent only: this spends NEAR AI credit and signs with the agent key.
  app.post("/api/propose", async (c) => {
    if (!agentToken) return c.json({ error: "AGENT_API_TOKEN is not configured" }, 503);
    if (!tokenMatches(c.req.header("authorization"), agentToken)) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    if (typeof body === "object" && body !== null && "cross_chain" in body) return proposeCrossChain(body);
    const checked = checkPropose(body, { network, model, now: Date.now() });
    if ("error" in checked) return c.json({ error: checked.error }, 400);
    if (!store.getMandate(checked.mandate_id)) return c.json({ error: "unknown mandate_id" }, 400);
    const p = store.createProposal(checked);
    startPipeline(p.id);
    return c.json({ proposal_id: p.id });
  });

  // The second body: the agent states the payment, the API quotes it and builds the transfer.
  async function proposeCrossChain(body: object): Promise<Response> {
    const json = (data: object, status: 400 | 501 | 502 | 200 = 200) => Response.json(data, { status });
    if (!crossChain) return json({ error: "cross-chain payments are off: the firewall core's judge() does not take cross_chain yet" }, 501);
    const checked = checkCrossChainPropose(body, { network });
    if ("error" in checked) return json({ error: checked.error }, 400);
    if (!store.getMandate(checked.mandate_id)) return json({ error: "unknown mandate_id" }, 400);
    const { intent } = checked;

    let paid;
    try {
      paid = await crossChain.pay({
        amount: intent.amount, origin_asset: `nep141:${intent.token}`, dest_asset: intent.dest_asset, recipient: intent.recipient, refund_to: crossChain.refundTo,
      });
    } catch (e) {
      return json({ error: `could not get a 1Click quote: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}` }, 502);
    }
    // Anything not on mainnet is the stand-in, so every delivery it reports is simulated.
    const built = buildCrossChain(intent, paid, { now: Date.now(), simulated: network !== "mainnet" });
    if ("error" in built) return json({ error: `unusable 1Click quote: ${built.error}` }, 502);
    // The same checks as an agent-built action, so nothing is stored that the wallet would refuse for its form.
    const ok = checkPropose({ mandate_id: checked.mandate_id, action: built.action, args: built.args, context: checked.context }, { network, model, now: Date.now() });
    if ("error" in ok) return json({ error: `unusable 1Click quote: ${ok.error}` }, 502);

    const p = store.createProposal({ ...ok, cross_chain: built.cross_chain, oneclick: built.oneclick });
    startPipeline(p.id);
    return json({ proposal_id: p.id });
  }

  // Public: everything here is also on-chain. `since` is "changed after", so status changes reach the feed.
  app.get("/api/proposals", (c) => {
    const since = Number(c.req.query("since") ?? 0);
    if (!Number.isInteger(since) || since < 0) return c.json({ error: "since must be a millisecond timestamp" }, 400);
    return c.json(store.proposalsSince(since).map((p) => toProposal(p, attestationUrls)));
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
