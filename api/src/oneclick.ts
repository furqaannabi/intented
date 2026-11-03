// The 1Click module (interface spec): a cross-chain payment is a quote with a
// deposit address; the wallet contract executes ft_transfer to that address,
// and 1Click delivers on the destination chain. Plain fetch against
// https://1click.chaindefuser.com/docs/v0/openapi.yaml, no SDK.

import { createHash, createPublicKey, verify } from "node:crypto";

const BASE_URL = "https://1click.chaindefuser.com";

/** 1Click's quote-signing key, from its TypeScript SDK (0.1.26). The owner registers it on a mainnet wallet. */
export const ONE_CLICK_MANAGER_KEY = "ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc";

/** A /v0/quote response as 1Click signs it. */
export interface QuoteResponse {
  quote: Record<string, unknown>;
  quoteRequest: Record<string, unknown>;
  signature: string;
  timestamp: string;
}

/** The judge request's `cross_chain.signed_quote`: what 1Click signed, and its signature. */
export interface SignedQuote {
  payload: string;
  signature: string;
}

// The fields 1Click signs, from its SDK's buildSignedQuoteRequest and buildSignedQuote (0.1.26). Anything else in the
// response is unsigned (decisions/2026-11-03-accept-signed-1click-quote.md). "Optional" fields count only when set.
const REQUEST_FIELDS = ["dry", "swapType", "slippageTolerance", "originAsset", "depositType", "destinationAsset", "amount", "refundTo", "refundType", "recipient", "recipientType", "deadline"];
const REQUEST_OPTIONAL = ["quoteWaitingTimeMs", "referral", "virtualChainRecipient", "virtualChainRefundRecipient", "customRecipientMsg"];
const QUOTE_FIELDS = ["amountIn", "amountInFormatted", "amountInUsd", "minAmountIn", "amountOut", "amountOutFormatted", "amountOutUsd", "minAmountOut"];
const QUOTE_OPTIONAL = ["depositAddress", "depositMemo", "deadline", "timeWhenInactive", "timeEstimate", "refundFee", "withdrawFee"];

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58(bytes: Uint8Array): string {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b) break;
    out = `1${out}`;
  }
  return out;
}

function unbase58(text: string): Buffer {
  let n = 0n;
  for (const c of text) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("not base58");
    n = n * 58n + BigInt(i);
  }
  const hex = n ? n.toString(16).padStart(Math.ceil(n.toString(16).length / 2) * 2, "0") : "";
  return Buffer.concat([Buffer.alloc(text.match(/^1*/)![0].length), Buffer.from(hex, "hex")]);
}

/** json-stable-stringify: keys sorted, compact, undefined members dropped. */
function stableJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}

/** The payload 1Click signed for this quote, built from its signed fields only, with its signature. */
export function signedQuote(r: QuoteResponse): SignedQuote {
  const pick = (from: Record<string, unknown>, always: string[], ifSet: string[]) => ({
    ...Object.fromEntries(always.map((k) => [k, from[k]])),
    ...Object.fromEntries(ifSet.map((k) => [k, from[k] || undefined])),
  });
  // A dry quote has no deposit details; 1Click signs only the amounts.
  const quote = pick(r.quote, QUOTE_FIELDS, r.quoteRequest.dry ? [] : QUOTE_OPTIONAL);
  return { payload: stableJson({ ...pick(r.quoteRequest, REQUEST_FIELDS, REQUEST_OPTIONAL), ...quote, timestamp: r.timestamp }), signature: r.signature };
}

/** The bytes 1Click signs with ed25519: the UTF-8 of base58(sha256(payload)). */
export const quoteMessage = (payload: string) => Buffer.from(base58(createHash("sha256").update(payload, "utf8").digest()), "utf8");

export function verifySignedQuote(q: SignedQuote, publicKey: string): boolean {
  try {
    const raw = unbase58(publicKey.replace(/^ed25519:/, ""));
    const key = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]), format: "der", type: "spki" });
    return verify(null, quoteMessage(q.payload), key, unbase58(q.signature.replace(/^ed25519:/, "")));
  } catch {
    return false;
  }
}

export interface OneClickConfig {
  /** Optional partner JWT. Without it 1Click charges 0.2%. Never logged. */
  jwt?: string;
  baseUrl?: string;
}

export interface CrossChainPayment {
  /** What the recipient receives, exactly, in the destination asset's smallest unit, as a decimal string. */
  amount: string;
  /** 1Click asset ids, e.g. `nep141:17208628…` for NEAR USDC. */
  origin_asset: string;
  dest_asset: string;
  /** Address on the destination chain. */
  recipient: string;
  /** Account on the origin chain that gets the deposit back if the swap fails. */
  refund_to: string;
}

export interface Quote {
  depositAddress?: string;
  depositMemo?: string;
  /** What to send: the input with the slippage buffer. 1Click refunds what the swap doesn't use to `refund_to`. */
  amountIn: string;
  /** The least deposit 1Click will swap; below it the deposit is refunded. */
  minAmountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  minAmountOut: string;
  deadline?: string;
  timeEstimate: number;
}

export type DepositStatus =
  | "KNOWN_DEPOSIT_TX"
  | "PENDING_DEPOSIT"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

/**
 * Exact output, so the vendor receives exactly its price: the 1% slippage is
 * taken on the input side. Deposit and refund on the origin chain, delivery on
 * the destination chain.
 */
function quoteRequest(p: CrossChainPayment, dry: boolean, deadlineMs: number) {
  return {
    dry,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: p.origin_asset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: p.dest_asset,
    amount: p.amount,
    refundTo: p.refund_to,
    refundType: "ORIGIN_CHAIN",
    recipient: p.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + deadlineMs).toISOString(),
  };
}

export function createOneClick(config: OneClickConfig = {}) {
  const baseUrl = config.baseUrl ?? BASE_URL;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.jwt) headers.Authorization = `Bearer ${config.jwt}`;

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    if (!res.ok) throw new Error(`1Click ${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as T;
  }

  async function quote(p: CrossChainPayment, dry: boolean, deadlineMs: number): Promise<QuoteResponse & { quote: Quote }> {
    const body = JSON.stringify(quoteRequest(p, dry, deadlineMs));
    return call<QuoteResponse & { quote: Quote }>("/v0/quote", { method: "POST", body });
  }

  return {
    /** Prices and fees for a payment, without creating a deposit address. Nothing is committed. */
    previewCrossChain: async (p: CrossChainPayment) => (await quote(p, true, 10 * 60_000)).quote,

    /** A live quote, with what 1Click signed. Funds sent to `deposit_address` before the deadline are swapped and delivered. */
    async payCrossChain(p: CrossChainPayment, deadlineMs = 30 * 60_000): Promise<{ deposit_address: string; quote: Quote; signed_quote: SignedQuote }> {
      const r = await quote(p, false, deadlineMs);
      const q = r.quote;
      if (!q.depositAddress) throw new Error("1Click returned a live quote without a deposit address");
      // A memo would have to travel with the ft_transfer; the NEAR route is not expected to need one.
      if (q.depositMemo) throw new Error("1Click returned a deposit memo; the wallet's ft_transfer does not carry one yet");
      return { deposit_address: q.depositAddress, quote: q, signed_quote: signedQuote(r) };
    },

    async trackDeposit(deposit_address: string): Promise<{ status: DepositStatus; dest_tx_hash?: string }> {
      const s = await call<{ status: DepositStatus; swapDetails?: { destinationChainTxHashes?: { hash: string }[] } }>(
        `/v0/status?depositAddress=${encodeURIComponent(deposit_address)}`,
      );
      const dest_tx_hash = s.swapDetails?.destinationChainTxHashes?.[0]?.hash;
      return dest_tx_hash ? { status: s.status, dest_tx_hash } : { status: s.status };
    },

    /** Tells 1Click the deposit was sent, so it picks it up sooner. On NEAR, `near_sender` is the account that signed the transaction. */
    async submitDeposit(deposit_address: string, tx_hash: string, near_sender?: string): Promise<void> {
      const body = { txHash: tx_hash, depositAddress: deposit_address, ...(near_sender ? { nearSenderAccount: near_sender } : {}) };
      await call("/v0/deposit/submit", { method: "POST", body: JSON.stringify(body) });
    },
  };
}
