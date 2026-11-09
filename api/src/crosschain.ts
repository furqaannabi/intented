// A payment through 1Click (decisions/2026-11-03-cross-chain-through-1click.md): the agent states the intent to
// POST /api/quote; the API quotes it and works out the ft_transfer to the deposit address, so the agent never picks
// a deposit address.

import { createHash } from "node:crypto";
import { KNOWN_TOKENS, type Network } from "@intented/firewall-core";
import type { SignedQuote } from "./oneclick.js";
import type { ActionJson } from "./store.js";

const POSITIVE = /^[1-9][0-9]*$/;
const U128_MAX = (1n << 128n) - 1n;

/** Destination assets the API will quote, by 1Click asset id. The same ids on mainnet and on the testnet stand-in. */
export const DEST_ASSETS: Record<string, { chain: string; symbol: string; decimals: number }> = {
  "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near": { chain: "base", symbol: "USDC", decimals: 6 },
};

export interface CrossChainIntent {
  /** The NEAR token the wallet pays with: one of the firewall core's known token contracts. */
  token: string;
  /** What the recipient receives, exactly, in the destination asset's smallest unit. */
  amount: string;
  dest_chain: string;
  dest_asset: string;
  /** Lowercase 0x + 40 hex. */
  recipient: string;
}

/** A payment through 1Click as the agent states it, or why it is refused. `field` names it in the error. */
export function checkIntent(value: unknown, network: Network, field: string): CrossChainIntent | { error: string } {
  if (typeof value !== "object" || value === null) return { error: `${field} must be an object` };
  const opts = { network };
  const { token, amount, dest_chain, dest_asset, recipient } = value as Record<string, unknown>;
  if (typeof token !== "string" || !KNOWN_TOKENS[opts.network].some((t) => t.contract === token)) {
    return { error: `${field}.token must be a known token contract on ${opts.network}` };
  }
  if (typeof amount !== "string" || !POSITIVE.test(amount) || BigInt(amount) > U128_MAX) {
    return { error: `${field}.amount must be a positive decimal string, in the destination asset's smallest unit` };
  }
  const dest = typeof dest_asset === "string" ? DEST_ASSETS[dest_asset] : undefined;
  if (!dest) return { error: `${field}.dest_asset must be one of: ${Object.keys(DEST_ASSETS).join(", ")}` };
  if (dest_chain !== dest.chain) return { error: `${field}.dest_chain must be "${dest.chain}" for that asset` };
  // Letter case in an EVM address is only a checksum, so lowercasing loses nothing; the wallet requires lowercase.
  if (typeof recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) return { error: `${field}.recipient must be 0x plus 40 hex characters` };

  return { token, amount, dest_chain: dest.chain, dest_asset: dest_asset as string, recipient: recipient.toLowerCase() };
}

/** The action's expiry: well inside the quote, so 1Click is still taking deposits when the transfer lands. */
export const EXPIRY_MS = 10 * 60_000;
export const DEADLINE_MARGIN_MS = 5 * 60_000;

/** The judge request's `cross_chain` field (interface spec), filled from the quote. */
export interface CrossChainField {
  deposit_address: string;
  dest_chain: string;
  dest_asset: string;
  recipient: string;
  amount_out: string;
  deadline_ms: string;
  /** What 1Click signed for this quote; execute verifies it, so the deposit address isn't the API's word. */
  signed_quote: SignedQuote;
}

/** `Proposal.oneclick`: the deposit as the web app shows it. */
export interface OneClickState {
  deposit_address: string;
  dest_chain: string;
  recipient: string;
  amount_out: string;
  status: string;
  dest_tx_hash?: string;
  simulated: boolean;
}

/** 1Click's `amountOutFormatted`, from the payload it signed: the wallet requires amount_out to start with it. */
function signedAmountOutFormatted(payload: string): string | undefined {
  try {
    const v = (JSON.parse(payload) as Record<string, unknown>).amountOutFormatted;
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** A plain decimal in whole tokens, in the smallest unit: "2.0", 6 -> 2000000n. Undefined for anything else. */
function toUnits(formatted: string, decimals: number): bigint | undefined {
  const m = /^([0-9]+)(?:\.([0-9]+))?$/.exec(formatted);
  if (!m) return undefined;
  const fraction = (m[2] ?? "").replace(/0+$/, "");
  if (fraction.length > decimals) return undefined;
  return BigInt(m[1] + fraction.padEnd(decimals, "0"));
}

/**
 * The ft_transfer of the quoted input to the deposit address, and what the
 * judge and the web app are told about the payment. The input is still
 * checked by checkPropose afterwards, like any other.
 */
export function buildCrossChain(
  intent: CrossChainIntent,
  paid: { deposit_address: string; quote: { amountIn: string; amountOut: string; deadline?: string }; signed_quote: SignedQuote },
  opts: { now: number; simulated: boolean },
): { action: ActionJson; args: string; cross_chain: CrossChainField; oneclick: OneClickState } | { error: string } {
  const { quote, deposit_address } = paid;
  const deadline = quote.deadline ? Date.parse(quote.deadline) : NaN;
  if (!Number.isFinite(deadline)) return { error: "the quote has no deadline" };
  if (!POSITIVE.test(quote.amountIn)) return { error: "the quote's amountIn is not a positive decimal" };
  // Exact output: the recipient must get at least what was asked.
  if (!POSITIVE.test(quote.amountOut) || BigInt(quote.amountOut) < BigInt(intent.amount)) return { error: "the quote delivers less than the amount" };

  const args = JSON.stringify({ receiver_id: deposit_address, amount: quote.amountIn });
  const action: ActionJson = {
    receiver_id: intent.token,
    method: "ft_transfer",
    args_sha256: createHash("sha256").update(args, "utf8").digest("hex"),
    deposit: "1",
    nonce: String(opts.now),
    expiry_ms: String(Math.min(opts.now + EXPIRY_MS, deadline - DEADLINE_MARGIN_MS)),
  };
  const dest = DEST_ASSETS[intent.dest_asset]!;
  // 1Click's own text, as it signed it ("2.0", not "2"): the wallet checks amount_out starts with it and a space.
  // It must say the same amount as amountOut, so the judge isn't told a different figure from the one 1Click delivers.
  const formatted = signedAmountOutFormatted(paid.signed_quote.payload);
  if (formatted === undefined || toUnits(formatted, dest.decimals) !== BigInt(quote.amountOut)) {
    return { error: "the signed quote's amountOutFormatted is not its amountOut" };
  }
  const amount_out = `${formatted} ${dest.symbol}`;
  return {
    action,
    args,
    cross_chain: {
      deposit_address,
      dest_chain: intent.dest_chain,
      dest_asset: intent.dest_asset,
      recipient: intent.recipient,
      amount_out,
      deadline_ms: String(deadline),
      signed_quote: paid.signed_quote,
    },
    oneclick: { deposit_address, dest_chain: intent.dest_chain, recipient: intent.recipient, amount_out, status: "PENDING_DEPOSIT", simulated: opts.simulated },
  };
}
