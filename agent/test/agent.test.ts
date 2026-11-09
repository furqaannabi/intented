import { createHash } from "node:crypto";
import { Hono, type Context } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAgent, type OneClick } from "../src/agent.js";
import { BASE_USDC_CONTRACT } from "../src/base.js";
import { BASE_USDC } from "../src/oneclick-standin.js";
import { createPaywall, type BaseConfig } from "../src/paywall.js";
import type { Payment } from "../src/wallet.js";
import { decode, type PaymentPayload } from "../src/x402.js";

const VENDOR = "0x7284d41b5b852f2bd4c99bdf95043d84452d299c";
const DEPOSIT = "intented-1click.testnet";
const DEPOSIT_TX = "DepositTx111111111111111111111111111111111111";
const MANDATE = "Buy market data; pay the vendor on Base.";
const HASH = createHash("sha256").update(MANDATE, "utf8").digest("hex");
const oneclick = (status: string, over: Partial<OneClick> = {}): OneClick => ({
  deposit_address: DEPOSIT, dest_chain: "base", recipient: VENDOR, amount_out: "2 USDC", status, simulated: true, ...over,
});

const DEADLINE = String(Date.now() + 30 * 60_000);

/**
 * A fake API (quote, verdict, executed, and a proposal whose 1Click status moves through `statuses`), a fake wallet
 * that records what the agent proposes and executes, and the real paywall, all behind a stubbed fetch.
 */
function setup(statuses: OneClick[], base: Omit<BaseConfig, "vendor">, verdict: "ALLOW" | "DENY" = "ALLOW", quoteRefused?: string) {
  const sent: Record<"quote" | "verdict" | "executed", Record<string, unknown>[]> = { quote: [], verdict: [], executed: [] };
  const proposed: Payment[] = [];
  const executed: number[] = [];
  const proofs: PaymentPayload["payload"][] = [];
  const record = (k: keyof typeof sent) => async (c: Context) => (sent[k].push(await c.req.json()), undefined);
  const api = new Hono()
    .get("/api/mandates/:hash", (c) => c.json({ mandate_id: "m_1", text: MANDATE, text_hash: HASH }))
    .post("/api/quote", async (c) => (await record("quote")(c), quoteRefused ? c.json({ error: quoteRefused }, 409) : c.json({ quote_id: "q_0123456789abcdef", deposit_address: DEPOSIT, token: "wrap.testnet", amount_in: "808", deadline_ms: DEADLINE, amount_out: "2 USDC" })))
    .post("/api/verdict", async (c) => (await record("verdict")(c), c.json({ id: "p_1", verdict, reason: `says ${verdict}`, signer: "0xs", signature: "0xsig", req_bytes: "AQ==", resp_bytes: "Ag==" })))
    .post("/api/executed", async (c) => (await record("executed")(c), c.json({ id: "p_1" })))
    .get("/api/proposals/:id", (c) => c.json({ oneclick: statuses.length > 1 ? statuses.shift()! : statuses[0]! }));
  const paywall = createPaywall({ lookupTx: async () => null, base: { vendor: VENDOR, ...base } });
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const sig = new Headers(init?.headers).get("PAYMENT-SIGNATURE");
    if (sig) proofs.push(decode<PaymentPayload>(sig)!.payload);
    return (url.host === "api" ? api : paywall).request(url.pathname + url.search, init);
  });
  const agent = {
    propose: async (p: Payment) => (proposed.push(p), { proposal_id: 3, near_tx_hash: "ProposeTx" }),
    execute: async (id: number) => (executed.push(id), { near_tx_hash: DEPOSIT_TX, ok: verdict === "ALLOW" }),
  };
  const run = (route = "base", prepareDeposit?: (token: string, depositAddress: string) => Promise<void>) =>
    runAgent(`http://paywall/${route}/market-data`, {
      apiUrl: "http://api", walletId: "intented-wallet.testnet", agentId: "intented-agent.testnet", agent, mandateHash: HASH, log: () => {}, pollMs: 1, prepareDeposit,
    });
  return { sent, proposed, executed, proofs, run };
}

// What the stand-in reports once it has confirmed DEPOSIT_TX and "delivered".
const delivered: BaseConfig["lookupDelivery"] = async () => ({
  status: "SUCCESS",
  quoteResponse: { quote: { amountOut: "2000000" }, quoteRequest: { recipient: VENDOR, destinationAsset: BASE_USDC } },
  swapDetails: { originChainTxHashes: [{ hash: DEPOSIT_TX }] },
});

afterEach(() => vi.unstubAllGlobals());

describe("agent: a 402 on Base, paid through 1Click", () => {
  it("asks the API to quote it, proposes exactly the quoted transfer with its own key, and gets the verdict on the quote", async () => {
    const { sent, proposed, run } = setup([oneclick("SUCCESS")], { lookupDelivery: delivered });
    await run();
    expect(sent.quote).toEqual([{ wallet_id: "intented-wallet.testnet", intent: { token: "wrap.testnet", amount: "2000000", dest_chain: "base", dest_asset: BASE_USDC, recipient: VENDOR } }]);
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({ token: "wrap.testnet", to: DEPOSIT, amount: "808" });
    expect(proposed[0]!.expiresAt).toBeLessThan(Number(DEADLINE));
    expect(sent.verdict).toEqual([{ wallet_id: "intented-wallet.testnet", proposal_id: 3, context: expect.any(String), quote_id: "q_0123456789abcdef" }]);
    expect(sent.executed).toEqual([{ wallet_id: "intented-wallet.testnet", proposal_id: 3, near_tx_hash: DEPOSIT_TX }]);
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

  it("reports a quote the API refuses as not paid, and proposes nothing", async () => {
    const { proposed, proofs, run } = setup([oneclick("PENDING_DEPOSIT")], { lookupDelivery: delivered }, "ALLOW", "0xbad isn't on the wallet's cross-chain recipient list");
    const r = await run();
    expect(proposed).toEqual([]);
    expect(proofs).toEqual([]);
    expect(r).toMatchObject({ status: "failed", verdict: null, reason: expect.stringMatching(/409 0xbad isn't on/), data: null });
  });

  it("has the deposit address made ready for the token before it proposes, when asked to", async () => {
    const { proposed, run } = setup([oneclick("SUCCESS")], { lookupDelivery: delivered });
    const calls: string[] = [];
    await run("base", async (token, address) => { calls.push(`${token} ${address} proposed=${proposed.length}`); });
    expect(calls).toEqual([`wrap.testnet ${DEPOSIT} proposed=0`]);
    expect(proposed).toHaveLength(1);
  });

  it("proposes nothing if the deposit address can't be made ready", async () => {
    const { proposed, run } = setup([oneclick("SUCCESS")], { lookupDelivery: delivered });
    const r = await run("base", async () => { throw new Error("storage_deposit failed"); });
    expect(proposed).toEqual([]);
    expect(r).toMatchObject({ status: "failed", verdict: null, reason: expect.stringMatching(/storage_deposit failed/), data: null });
  });

  it("hands a DENY to the wallet too, and never asks 1Click or the paywall", async () => {
    const { executed, proofs, sent, run } = setup([oneclick("PENDING_DEPOSIT")], { lookupDelivery: delivered }, "DENY");
    const r = await run();
    expect(executed).toEqual([3]);
    // The wallet's refusal is reported, so the receipt links it on chain.
    expect(sent.executed).toEqual([{ wallet_id: "intented-wallet.testnet", proposal_id: 3, near_tx_hash: DEPOSIT_TX }]);
    expect(proofs).toEqual([]);
    expect(r).toMatchObject({ status: "denied", verdict: "DENY", data: null });
  });

  it("on a real delivery, pays with the Base transaction", async () => {
    const pad = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
    const receipt = {
      status: "0x1",
      logs: [{ address: BASE_USDC_CONTRACT, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", pad("0x" + "1".repeat(40)), pad(VENDOR)], data: "0x1e8480" }],
    };
    const { proofs, run } = setup([oneclick("SUCCESS", { simulated: false, dest_tx_hash: "0xbasetx" })], { lookupReceipt: async (h) => (h === "0xbasetx" ? receipt : null) });
    const r = await run();
    expect(proofs).toEqual([{ transaction: "0xbasetx" }]);
    expect(r.data).not.toBeNull();
  });
});

describe("agent: a 402 on NEAR", () => {
  it("proposes the transfer the 402 asks for with its own key, and asks for the verdict without a quote", async () => {
    const { sent, proposed, run } = setup([oneclick("SUCCESS")], { lookupDelivery: delivered });
    await run("honest").catch(() => {}); // the fake wallet's transaction isn't on chain, so the paywall refuses it; only the steps matter
    expect(sent.quote).toEqual([]);
    expect(proposed).toEqual([{ token: "wrap.testnet", to: "intented-vendor.testnet", amount: expect.stringMatching(/^\d+$/), memo: "market data" }]);
    expect(sent.verdict[0]).not.toHaveProperty("quote_id");
  });
});
