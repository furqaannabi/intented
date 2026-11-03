// A testnet stand-in for 1Click, which runs on mainnet only. It speaks the
// three calls the API's 1Click module makes (quote, deposit submit, status),
// so the module only needs a different base URL. It quotes wNEAR on NEAR
// testnet for USDC on Base at a fixed demo rate, gives every quote the same
// deposit account, checks the real testnet deposit, and then reports a
// delivery that never happens: nothing reaches Base. Every delivery it
// reports is simulated. One quote at a time: a new live quote replaces the last.

import { Hono } from "hono";
import { findPayment } from "./payment.js";
import type { LookupTx } from "./paywall.js";

export const ORIGIN_ASSET = "nep141:wrap.testnet";
export const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const WNEAR_DECIMALS = 24;
const USDC_DECIMALS = 6;
const SLIPPAGE_BPS = 100n; // the buffer the API asks for; refunded on mainnet, kept here

export interface StandInConfig {
  /** The testnet account every quote deposits to. It must be registered on wrap.testnet. */
  depositAddress: string;
  lookupTx: LookupTx;
  /** The fixed demo rate: whole USDC per whole wNEAR. */
  usdcPerWnear?: bigint;
  /** How long after a confirmed deposit the simulated delivery is reported. */
  deliverAfterMs?: number;
  now?: () => number;
}

type Status = "PENDING_DEPOSIT" | "PROCESSING" | "SUCCESS" | "FAILED";

interface Live {
  quote: Record<string, unknown>;
  quoteRequest: Record<string, unknown>;
  amountIn: string;
  deadlineMs: number;
  depositedAt?: number;
  depositTx?: string;
  updatedAt: number;
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function formatUnits(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function createOneClickStandIn(config: StandInConfig) {
  const rate = config.usdcPerWnear ?? 500n;
  const deliverAfterMs = config.deliverAfterMs ?? 5000;
  const now = config.now ?? Date.now;
  let live: Live | null = null;
  const app = new Hono();

  const status = (l: Live): Status => {
    if (l.depositedAt === undefined) return now() > l.deadlineMs ? "FAILED" : "PENDING_DEPOSIT";
    return now() - l.depositedAt >= deliverAfterMs ? "SUCCESS" : "PROCESSING";
  };

  app.post("/v0/quote", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ message: "body must be JSON" }, 400);
    if (body.swapType !== "EXACT_OUTPUT") return c.json({ message: "the stand-in only quotes EXACT_OUTPUT" }, 400);
    if (body.originAsset !== ORIGIN_ASSET || body.destinationAsset !== BASE_USDC) {
      return c.json({ message: `the stand-in only quotes ${ORIGIN_ASSET} for ${BASE_USDC}` }, 400);
    }
    if (typeof body.amount !== "string" || !/^[1-9][0-9]*$/.test(body.amount)) return c.json({ message: "amount is not valid" }, 400);
    if (typeof body.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(body.recipient)) return c.json({ message: "recipient is not valid" }, 400);
    const deadlineMs = Date.parse(String(body.deadline));
    if (!Number.isFinite(deadlineMs)) return c.json({ message: "deadline is not valid" }, 400);

    // USDC has 6 decimals and wNEAR 24, so a USDC unit at `rate` costs 10^18 / rate wNEAR units.
    const amountOut = BigInt(body.amount);
    const minAmountIn = ceilDiv(amountOut * 10n ** BigInt(WNEAR_DECIMALS - USDC_DECIMALS), rate);
    const amountIn = ceilDiv(minAmountIn * (10000n + SLIPPAGE_BPS), 10000n);
    const usd = (wnear: bigint) => formatUnits(ceilDiv(wnear * rate, 10n ** BigInt(WNEAR_DECIMALS - USDC_DECIMALS)), USDC_DECIMALS);

    const quote: Record<string, unknown> = {
      ...(body.dry ? {} : { depositAddress: config.depositAddress }),
      amountIn: amountIn.toString(),
      amountInFormatted: formatUnits(amountIn, WNEAR_DECIMALS),
      amountInUsd: usd(amountIn),
      minAmountIn: minAmountIn.toString(),
      amountOut: amountOut.toString(),
      amountOutFormatted: formatUnits(amountOut, USDC_DECIMALS),
      amountOutUsd: formatUnits(amountOut, USDC_DECIMALS),
      minAmountOut: amountOut.toString(),
      deadline: new Date(deadlineMs).toISOString(),
      timeEstimate: Math.round(deliverAfterMs / 1000),
    };
    if (!body.dry) live = { quote, quoteRequest: body, amountIn: amountIn.toString(), deadlineMs, updatedAt: now() };
    return c.json({ quote, quoteRequest: body, timestamp: new Date(now()).toISOString(), simulated: true });
  });

  app.post("/v0/deposit/submit", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { txHash?: unknown; depositAddress?: unknown; nearSenderAccount?: unknown } | null;
    if (!live || body?.depositAddress !== config.depositAddress) return c.json({ message: "no live quote for that deposit address" }, 404);
    if (typeof body.txHash !== "string" || typeof body.nearSenderAccount !== "string") {
      return c.json({ message: "txHash and nearSenderAccount are required on NEAR" }, 400);
    }
    if (live.depositedAt === undefined) {
      if (now() > live.deadlineMs) return c.json({ message: "the quote's deadline has passed" }, 400);
      const tx = await config.lookupTx(body.txHash, body.nearSenderAccount);
      const found = tx
        ? findPayment(tx as Parameters<typeof findPayment>[0], { asset: "wrap.testnet", payTo: config.depositAddress, amount: live.amountIn })
        : { ok: false as const, error: "transaction not found" };
      if (!found.ok) return c.json({ message: `${found.error}: the deposit must be exactly amountIn` }, 400);
      live.depositedAt = now();
      live.depositTx = body.txHash;
      live.updatedAt = now();
    }
    return c.json({ quoteResponse: { quote: live.quote, quoteRequest: live.quoteRequest }, status: status(live), simulated: true });
  });

  app.get("/v0/status", (c) => {
    if (!live || c.req.query("depositAddress") !== config.depositAddress) return c.json({ message: "deposit address not found" }, 404);
    const s = status(live);
    // The confirmed deposit is reported as real 1Click does; destinationChainTxHashes stays empty: nothing is sent on Base.
    return c.json({
      quoteResponse: { quote: live.quote, quoteRequest: live.quoteRequest },
      status: s,
      updatedAt: new Date(live.updatedAt).toISOString(),
      swapDetails: { originChainTxHashes: live.depositTx ? [{ hash: live.depositTx }] : [], destinationChainTxHashes: [] },
      simulated: true,
    });
  });

  return app;
}
