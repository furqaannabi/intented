// The HTTP API (interface spec). Behaviour: decisions/2026-11-01-api-pipeline-behaviour.md.

import { createHash, timingSafeEqual } from "node:crypto";
import type { Network } from "@intented/firewall-core";
import { Hono } from "hono";
import { cors } from "hono/cors";
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
    attestation_url: (p.signer && attestationUrls[p.signer]) || null,
    ...(p.near_tx_hash ? { near_tx_hash: p.near_tx_hash } : {}),
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
  /** Origins the web app is served from (WEB_ORIGINS). */
  corsOrigins?: string[];
}

/** Constant-time, so the token can't be guessed byte by byte from response times. */
function tokenMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function createApp({ store, network, model, agentToken, startPipeline, attestationUrls, corsOrigins = [] }: AppDeps) {
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

  // The agent only: this spends NEAR AI credit and signs with the agent key.
  app.post("/api/propose", async (c) => {
    if (!agentToken) return c.json({ error: "AGENT_API_TOKEN is not configured" }, 503);
    if (!tokenMatches(c.req.header("authorization"), agentToken)) return c.json({ error: "unauthorized" }, 401);
    const checked = checkPropose(await c.req.json().catch(() => null), { network, model, now: Date.now() });
    if ("error" in checked) return c.json({ error: checked.error }, 400);
    if (!store.getMandate(checked.mandate_id)) return c.json({ error: "unknown mandate_id" }, 400);
    const p = store.createProposal(checked);
    startPipeline(p.id);
    return c.json({ proposal_id: p.id });
  });

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

  return app;
}
