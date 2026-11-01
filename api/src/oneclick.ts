// The 1Click module (interface spec): a cross-chain payment is a quote with a
// deposit address; the wallet contract executes ft_transfer to that address,
// and 1Click delivers on the destination chain. Plain fetch against
// https://1click.chaindefuser.com/docs/v0/openapi.yaml, no SDK.

const BASE_URL = "https://1click.chaindefuser.com";

export interface OneClickConfig {
  /** Optional partner JWT. Without it 1Click charges 0.2%. Never logged. */
  jwt?: string;
  baseUrl?: string;
}

export interface CrossChainPayment {
  /** In the origin asset's smallest unit, as a decimal string. */
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
  amountIn: string;
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

/** Exact input, 1% slippage, deposit and refund on the origin chain, delivery on the destination chain. */
function quoteRequest(p: CrossChainPayment, dry: boolean, deadlineMs: number) {
  return {
    dry,
    swapType: "EXACT_INPUT",
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

  async function quote(p: CrossChainPayment, dry: boolean, deadlineMs: number): Promise<Quote> {
    const body = JSON.stringify(quoteRequest(p, dry, deadlineMs));
    return (await call<{ quote: Quote }>("/v0/quote", { method: "POST", body })).quote;
  }

  return {
    /** Prices and fees for a payment, without creating a deposit address. Nothing is committed. */
    previewCrossChain: (p: CrossChainPayment) => quote(p, true, 10 * 60_000),

    /** A live quote. Funds sent to `deposit_address` before the deadline are swapped and delivered. */
    async payCrossChain(p: CrossChainPayment, deadlineMs = 30 * 60_000): Promise<{ deposit_address: string; quote: Quote }> {
      const q = await quote(p, false, deadlineMs);
      if (!q.depositAddress) throw new Error("1Click returned a live quote without a deposit address");
      // A memo would have to travel with the ft_transfer; the NEAR route is not expected to need one.
      if (q.depositMemo) throw new Error("1Click returned a deposit memo; the wallet's ft_transfer does not carry one yet");
      return { deposit_address: q.depositAddress, quote: q };
    },

    async trackDeposit(deposit_address: string): Promise<{ status: DepositStatus; dest_tx_hash?: string }> {
      const s = await call<{ status: DepositStatus; swapDetails?: { destinationChainTxHashes?: { hash: string }[] } }>(
        `/v0/status?depositAddress=${encodeURIComponent(deposit_address)}`,
      );
      const dest_tx_hash = s.swapDetails?.destinationChainTxHashes?.[0]?.hash;
      return dest_tx_hash ? { status: s.status, dest_tx_hash } : { status: s.status };
    },

    /** Optional: tells 1Click the deposit was sent, so it picks it up sooner. */
    async submitDeposit(deposit_address: string, tx_hash: string): Promise<void> {
      await call("/v0/deposit/submit", { method: "POST", body: JSON.stringify({ txHash: tx_hash, depositAddress: deposit_address }) });
    },
  };
}
