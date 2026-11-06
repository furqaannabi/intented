// POST /api/verdict: a verdict on a proposal a factory wallet's own agent made
// (decisions/2026-11-04-accept-verdict-for-any-wallet.md). The API reads the
// action from the chain, judges it once, and returns the signed verdict; the
// agent sends execute itself, so the API holds no key for these wallets.

import type { Action, Judgement, Network } from "@intented/firewall-core";
import { checkIntent, type CrossChainField, type CrossChainIntent } from "./crosschain.js";
import type { ChainProposal, ChainTx, WalletConfig } from "./wallet.js";

/** Verdicts judged per wallet, and for all wallets together, per window. A repeat that gets the stored answer isn't counted. */
export const VERDICT_LIMIT = { perClient: 30, total: 300, windowMs: 60 * 60_000 };
/** The agent still has to send execute after the verdict, so less than this left is refused before judging. */
/** 1Click quotes per wallet and across all wallets per hour: each one spends the 1Click JWT's quota. */
export const QUOTE_LIMIT = { perClient: 30, total: 120, windowMs: 60 * 60_000 };
export const MIN_LEFT_MS = 60_000;
const MAX_CONTEXT_CHARS = 20_000;

export interface VerdictDeps {
  /** `crossChain` only for a payment through 1Click, built from the API's own stored quote. */
  judge: (mandateText: string, action: Action, argsJson: string, context: string, crossChain?: CrossChainField) => Promise<Judgement>;
  readWallet: (walletId: string) => { config(): Promise<WalletConfig>; proposal(id: number): Promise<ChainProposal | null> };
  /** What this API judges with; a wallet that expects anything else would refuse the verdict. */
  expected: { model: string; promptHash: string };
  /** Wallets are <label>.<factoryId>, which only the factory can create, plus the API's own. No factory (mainnet): the API's own only. */
  factoryId?: string;
  ownWalletId: string;
  /** Starts following the stored proposal until the wallet's record settles it. */
  settle: (proposalId: string) => void;
  /** Looks up a transaction by hash and signer, final; null if there is none. */
  readTx: (hash: string, signerId: string) => Promise<ChainTx | null>;
  limit?: typeof VERDICT_LIMIT;
  /** Verdicts judged across all wallets in any 24 hours (VERDICT_DAILY_CAP), on top of `limit`. Unset, no daily cap. */
  dailyCap?: number;
  quoteLimit?: typeof QUOTE_LIMIT;
}

/** A NEAR transaction hash: base58 of 32 bytes. */
const TX_HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export type ExecutedRequest = { wallet_id: string; proposal_id: number; near_tx_hash: string };

/** POST /api/executed's body, or why it is refused. */
export function checkExecutedRequest(body: unknown, d: Pick<VerdictDeps, "factoryId" | "ownWalletId">): ExecutedRequest | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "body must be a JSON object" };
  const { near_tx_hash, ...rest } = body as Record<string, unknown>;
  const req = checkVerdictRequest({ ...rest, context: "" }, d);
  if ("error" in req) return req;
  if (typeof near_tx_hash !== "string" || !TX_HASH.test(near_tx_hash)) return { error: "near_tx_hash must be a NEAR transaction hash" };
  return { wallet_id: req.wallet_id, proposal_id: req.proposal_id, near_tx_hash };
}

export type VerdictRequest = { wallet_id: string; proposal_id: number; context: string; quote_id?: string };

const LABEL = /^(?:[a-z\d]+[-_])*[a-z\d]+$/;

/** The request, or why it is refused (a 400). */
export function checkVerdictRequest(body: unknown, d: Pick<VerdictDeps, "factoryId" | "ownWalletId">): VerdictRequest | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "body must be a JSON object" };
  const { wallet_id, proposal_id, context, quote_id } = body as Record<string, unknown>;
  const suffix = `.${d.factoryId}`;
  const isFactory = !!d.factoryId && typeof wallet_id === "string" && wallet_id.endsWith(suffix) && LABEL.test(wallet_id.slice(0, -suffix.length)) && wallet_id.length <= 64;
  if (wallet_id !== d.ownWalletId && !isFactory) return { error: d.factoryId ? `wallet_id must be ${d.ownWalletId} or <name>.${d.factoryId}` : `wallet_id must be ${d.ownWalletId}` };
  if (typeof proposal_id !== "number" || !Number.isSafeInteger(proposal_id) || proposal_id < 0) return { error: "proposal_id must be the wallet's proposal id, a whole number" };
  if (typeof context !== "string") return { error: "context must be a string (it may be empty)" };
  if (context.length > MAX_CONTEXT_CHARS) return { error: `context is over ${MAX_CONTEXT_CHARS} characters` };
  if (quote_id !== undefined && (typeof quote_id !== "string" || !/^q_[0-9a-f]{16}$/.test(quote_id))) return { error: "quote_id must be an id from POST /api/quote" };
  return { wallet_id: wallet_id as string, proposal_id, context, ...(quote_id === undefined ? {} : { quote_id }) };
}

export type QuoteRequest = { wallet_id: string; intent: CrossChainIntent };

/** POST /api/quote's body, or why it is refused. */
export function checkQuoteRequest(body: unknown, d: Pick<VerdictDeps, "factoryId" | "ownWalletId">, network: Network): QuoteRequest | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "body must be a JSON object" };
  const { wallet_id, intent } = body as Record<string, unknown>;
  const w = checkVerdictRequest({ wallet_id, proposal_id: 0, context: "" }, d);
  if ("error" in w) return w;
  const i = checkIntent(intent, network, "intent");
  if ("error" in i) return i;
  return { wallet_id: w.wallet_id, intent: i };
}
