import { createHash } from "node:crypto";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAgent, type OneClick } from "../src/agent.js";
import { BASE_USDC_CONTRACT } from "../src/base.js";
import { BASE_USDC } from "../src/oneclick-standin.js";
import { createPaywall, type BaseConfig } from "../src/paywall.js";
import { decode, type PaymentPayload } from "../src/x402.js";

const VENDOR = "0x7284d41b5b852f2bd4c99bdf95043d84452d299c";
const DEPOSIT = "intented-1click.testnet";
const DEPOSIT_TX = "DepositTx111111111111111111111111111111111111";
const MANDATE = "Buy market data; pay the vendor on Base.";
const HASH = createHash("sha256").update(MANDATE, "utf8").digest("hex");
const oneclick = (status: string, over: Partial<OneClick> = {}): OneClick => ({
  deposit_address: DEPOSIT, dest_chain: "base", recipient: VENDOR, amount_out: "0.4 USDC", status, simulated: true, ...over,
});

/** A fake API whose proposal moves through the given 1Click statuses, and the real paywall, both behind a stubbed fetch. */
function setup(statuses: OneClick[], base: Omit<BaseConfig, "vendor">) {
  const proposed: Record<string, unknown>[] = [];
  const keys: (string | undefined)[] = [];
  const proofs: PaymentPayload["payload"][] = [];
  const api = new Hono()
    .get("/api/mandates/:hash", (c) => c.json({ mandate_id: "m_1", text: MANDATE, text_hash: HASH }))
    .post("/api/propose", async (c) => (keys.push(c.req.header("idempotency-key")), proposed.push(await c.req.json()), c.json({ proposal_id: "p_1" })))
    .get("/api/proposals/:id", (c) => {
      const oc = statuses.length > 1 ? statuses.shift()! : statuses[0]!;
      return c.json({ status: "executed", verdict: "ALLOW", reason: "ok", near_tx_hash: DEPOSIT_TX, oneclick: oc });
    });
  const paywall = createPaywall({ lookupTx: async () => null, base: { vendor: VENDOR, ...base } });
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const sig = new Headers(init?.headers).get("PAYMENT-SIGNATURE");
    if (sig) proofs.push(decode<PaymentPayload>(sig)!.payload);
    return (url.host === "api" ? api : paywall).request(url.pathname + url.search, init);
  });
  const run = () =>
    runAgent("http://paywall/base/market-data", {
      apiUrl: "http://api", apiToken: "t", agentId: "intented-agent.testnet", mandateHash: HASH, log: () => {}, pollMs: 1,
    });
  return { proposed, keys, proofs, run };
}

// What the stand-in reports once it has confirmed DEPOSIT_TX and "delivered".
const delivered: BaseConfig["lookupDelivery"] = async () => ({
  status: "SUCCESS",
  quoteResponse: { quote: { amountOut: "400000" }, quoteRequest: { recipient: VENDOR, destinationAsset: BASE_USDC } },
  swapDetails: { originChainTxHashes: [{ hash: DEPOSIT_TX }] },
});

afterEach(() => vi.unstubAllGlobals());

describe("agent: a 402 on Base, paid through 1Click", () => {
  it("proposes the payment as cross_chain, never as a transfer it built itself", async () => {
    const { proposed, run } = setup([oneclick("SUCCESS")], { lookupDelivery: delivered });
    await run();
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).not.toHaveProperty("action");
    expect(proposed[0]?.cross_chain).toEqual({ token: "wrap.testnet", amount: "400000", dest_chain: "base", dest_asset: BASE_USDC, recipient: VENDOR });
  });

  it("sends a fresh Idempotency-Key with each purchase, so a retry of one can't pay twice", async () => {
    const { keys, run } = setup([oneclick("SUCCESS")], { lookupDelivery: delivered });
    await run();
    // The fake API reports the same deposit both times, so the paywall rightly refuses the second; only the keys matter here.
    await run().catch(() => {});
    expect(keys).toHaveLength(2);
    for (const k of keys) expect(k).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("waits for delivery, then pays the paywall with the deposit and gets the data, marked simulated", async () => {
    const { proofs, run } = setup([oneclick("PENDING_DEPOSIT"), oneclick("PROCESSING"), oneclick("SUCCESS")], { lookupDelivery: delivered });
    const r = await run();
    expect(proofs).toEqual([{ transaction: DEPOSIT_TX, deposit_address: DEPOSIT }]);
    expect(r.oneclick?.status).toBe("SUCCESS");
    expect(r.data).toMatchObject({ simulated: true });
  });

  it("never asks for the data when 1Click refunds", async () => {
    const { proofs, run } = setup([oneclick("PROCESSING"), oneclick("REFUNDED")], { lookupDelivery: delivered });
    const r = await run();
    expect(proofs).toEqual([]);
    expect(r).toMatchObject({ status: "executed", data: null, oneclick: { status: "REFUNDED" } });
  });

  it("on a real delivery, pays with the Base transaction", async () => {
    const pad = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
    const receipt = {
      status: "0x1",
      logs: [{ address: BASE_USDC_CONTRACT, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", pad("0x" + "1".repeat(40)), pad(VENDOR)], data: "0x61a80" }],
    };
    const { proofs, run } = setup([oneclick("SUCCESS", { simulated: false, dest_tx_hash: "0xbasetx" })], { lookupReceipt: async (h) => (h === "0xbasetx" ? receipt : null) });
    const r = await run();
    expect(proofs).toEqual([{ transaction: "0xbasetx" }]);
    expect(r.data).not.toBeNull();
  });
});
