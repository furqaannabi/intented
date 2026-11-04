// POST /api/verdict: a verdict on a proposal a factory wallet's own agent made
// (decisions/2026-11-04-accept-verdict-for-any-wallet.md). The API reads the
// action from the chain, judges it once, and returns the signed verdict; the
// agent sends execute itself, so the API holds no key for these wallets.

import type { Action, Judgement } from "@intented/firewall-core";
import type { ChainProposal, WalletConfig } from "./wallet.js";

/** Verdicts judged per wallet, and for all wallets together, per window. A repeat that gets the stored answer isn't counted. */
export const VERDICT_LIMIT = { perClient: 30, total: 300, windowMs: 60 * 60_000 };
/** The agent still has to send execute after the verdict, so less than this left is refused before judging. */
export const MIN_LEFT_MS = 60_000;
const MAX_CONTEXT_CHARS = 20_000;

export interface VerdictDeps {
  judge: (mandateText: string, action: Action, argsJson: string, context: string) => Promise<Judgement>;
  readWallet: (walletId: string) => { config(): Promise<WalletConfig>; proposal(id: number): Promise<ChainProposal | null> };
  /** What this API judges with; a wallet that expects anything else would refuse the verdict. */
  expected: { model: string; promptHash: string };
  /** Wallets are <label>.<factoryId>, which only the factory can create, plus the API's own. */
  factoryId: string;
  ownWalletId: string;
  /** Starts following the stored proposal until the wallet's record settles it. */
  settle: (proposalId: string) => void;
  limit?: typeof VERDICT_LIMIT;
}

export type VerdictRequest = { wallet_id: string; proposal_id: number; context: string };

const LABEL = /^(?:[a-z\d]+[-_])*[a-z\d]+$/;

/** The request, or why it is refused (a 400). */
export function checkVerdictRequest(body: unknown, d: Pick<VerdictDeps, "factoryId" | "ownWalletId">): VerdictRequest | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "body must be a JSON object" };
  const { wallet_id, proposal_id, context } = body as Record<string, unknown>;
  const suffix = `.${d.factoryId}`;
  const isFactory = typeof wallet_id === "string" && wallet_id.endsWith(suffix) && LABEL.test(wallet_id.slice(0, -suffix.length)) && wallet_id.length <= 64;
  if (wallet_id !== d.ownWalletId && !isFactory) return { error: `wallet_id must be ${d.ownWalletId} or <name>.${d.factoryId}` };
  if (typeof proposal_id !== "number" || !Number.isSafeInteger(proposal_id) || proposal_id < 0) return { error: "proposal_id must be the wallet's proposal id, a whole number" };
  if (typeof context !== "string") return { error: "context must be a string (it may be empty)" };
  if (context.length > MAX_CONTEXT_CHARS) return { error: `context is over ${MAX_CONTEXT_CHARS} characters` };
  return { wallet_id: wallet_id as string, proposal_id, context };
}
