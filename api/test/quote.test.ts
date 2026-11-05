import { createHash, generateKeyPairSync, sign } from "node:crypto";
import type { Judgement } from "@intented/firewall-core";
import { describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/app.js";
import { base58, quoteMessage, type CrossChainPayment } from "../src/oneclick.js";
import { openStore } from "../src/store.js";
import type { CrossChainField } from "../src/crosschain.js";
import type { ChainProposal, WalletConfig } from "../src/wallet.js";

const WALLET = "shop-bot.intented.testnet";
const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const VENDOR = "0x7284d41b5b852f2bd4c99bdf95043d84452d299c";
const DEPOSIT = "intented-1click.testnet";
const RULES = "Pay the vendor's Base address in USDC.";
const RULES_HASH = createHash("sha256").update(RULES, "utf8").digest("hex");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const QUOTE_KEY = `ed25519:${base58(publicKey.export({ format: "der", type: "spki" }).subarray(-32))}`;
const signQuote = (payload: string) => ({ payload, signature: `ed25519:${base58(sign(null, quoteMessage(payload), privateKey))}` });

export function quoteSetup(opts: { limit?: { perClient: number; total: number; windowMs: number } } = {}) {
  const now = Date.now();
  const clock = { at: now };
  const store = openStore(":memory:");
  store.createMandate(RULES, RULES_HASH);
  const config: WalletConfig = {
    frozen: false, agent_id: WALLET, mandate_hash: RULES_HASH, model_id: "m", prompt_hash: "p",
    cross_chain_enabled: true, cross_chain_recipients: [VENDOR], one_click_key: QUOTE_KEY,
  };
  const asked: CrossChainPayment[] = [];
  const crossChain: AppDeps["crossChain"] = {
    refundTo: "intented-wallet.testnet",
    quoteKey: QUOTE_KEY,
    pay: async (p) => {
      asked.push(p);
      const quote = { amountIn: "808000000000000000000", amountOut: p.amount, deadline: new Date(now + 30 * 60_000).toISOString() };
      return { deposit_address: DEPOSIT, quote: quote as never, signed_quote: signQuote(JSON.stringify({ depositAddress: DEPOSIT, ...quote })) };
    },
  };
  const proposals = new Map<number, ChainProposal>();
  const judged: { argsJson: string; crossChain?: CrossChainField }[] = [];
  const judge = { failures: 0 };
  const verdicts: AppDeps["verdicts"] = {
    judge: async (_m, _a, argsJson, _c, crossChain): Promise<Judgement> => {
      judged.push({ argsJson, crossChain });
      if (judge.failures-- > 0) throw new Error("NEAR AI timed out");
      return { verdict: "ALLOW", reason: "ok", model: "m", chat_id: "c", signer: "0xs", signature: "0xsig", req_bytes: new Uint8Array([1]), resp_bytes: new Uint8Array([2]) };
    },
    readWallet: () => ({ config: async () => config, proposal: async (id) => proposals.get(id) ?? null }),
    expected: { model: "m", promptHash: "p" },
    factoryId: "intented.testnet",
    ownWalletId: "intented-wallet.testnet",
    settle: () => {},
    readTx: async () => null,
    quoteLimit: opts.limit,
  };
  const app = createApp({ store, network: "testnet", model: "m", agentToken: "t", startPipeline: () => {}, attestationUrls: {}, redteam: () => null, verdicts, crossChain, now: () => clock.at });
  const intent = { token: "wrap.testnet", amount: "400000", dest_chain: "base", dest_asset: BASE_USDC, recipient: VENDOR };
  const quote = (body: object) => app.request("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const verdict = (body: object) => app.request("/api/verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  /** The agent proposes what the quote says, as proposal `id`, with `over` changing the action or args. */
  const propose = (id: number, q: { deposit_address: string; token: string; amount_in: string }, over: { args?: object; action?: object } = {}) => {
    const args_json = JSON.stringify(over.args ?? { receiver_id: q.deposit_address, amount: q.amount_in });
    proposals.set(id, {
      action: {
        receiver_id: q.token, method: "ft_transfer", args_sha256: createHash("sha256").update(args_json).digest("hex"), deposit: "1",
        nonce: String(now + id), expiry_ms: String(now + 15 * 60_000), ...over.action,
      },
      args_json,
      status: "pending",
    });
  };
  return { app, store, config, asked, intent, quote, verdict, propose, judged, judge, now, clock };
}

describe("POST /api/quote", () => {
  it("quotes the payment with the wallet as the refund account, and says what to propose", async () => {
    const t = quoteSetup();
    const res = await t.quote({ wallet_id: WALLET, intent: t.intent });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      quote_id: expect.stringMatching(/^q_/), deposit_address: DEPOSIT, token: "wrap.testnet", amount_in: "808000000000000000000",
      deadline_ms: String(t.now + 30 * 60_000), amount_out: "0.4 USDC",
    });
    expect(t.asked).toEqual([{ amount: "400000", origin_asset: "nep141:wrap.testnet", dest_asset: BASE_USDC, recipient: VENDOR, refund_to: WALLET }]);
  });
});

describe("POST /api/quote refuses", () => {
  const refusals: [string, (c: WalletConfig) => void, RegExp][] = [
    ["cross-chain payments are off on the wallet", (c) => (c.cross_chain_enabled = false), /switched off/],
    ["the wallet expects quotes signed by another key", (c) => (c.one_click_key = "ed25519:other"), /another 1Click key/],
  ];
  for (const [what, change, error] of refusals) {
    it(`with 409, before spending a quote, when ${what}`, async () => {
      const t = quoteSetup();
      change(t.config);
      const res = await t.quote({ wallet_id: WALLET, intent: t.intent });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(error);
      expect(t.asked).toEqual([]);
    });
  }

  it("nothing for a recipient off the wallet's list: the model judges it, and the wallet refuses it at execute", async () => {
    const t = quoteSetup();
    t.config.cross_chain_recipients = ["0x" + "1".repeat(40)];
    expect((await t.quote({ wallet_id: WALLET, intent: t.intent })).status).toBe(200);
  });

  it("with 400 for a wallet the factory didn't make or a malformed intent, before spending a quote", async () => {
    const t = quoteSetup();
    for (const body of [
      { wallet_id: "evil.testnet", intent: t.intent },
      { wallet_id: WALLET, intent: { ...t.intent, recipient: "intented-attacker.testnet" } },
      { wallet_id: WALLET, intent: { ...t.intent, token: "evil.testnet" } },
      { wallet_id: WALLET },
    ]) expect((await t.quote(body)).status, JSON.stringify(body)).toBe(400);
    expect(t.asked).toEqual([]);
  });

  it("with 429 past the per-wallet cap, and past the cap across all wallets", async () => {
    const t = quoteSetup({ limit: { perClient: 2, total: 3, windowMs: 60 * 60_000 } });
    const ask = (wallet_id: string) => t.quote({ wallet_id, intent: t.intent });
    expect((await ask(WALLET)).status).toBe(200);
    expect((await ask(WALLET)).status).toBe(200);
    const perWallet = await ask(WALLET);
    expect(perWallet.status).toBe(429);
    expect(Number(perWallet.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await ask("other-bot.intented.testnet")).status).toBe(200);
    expect((await ask("third-bot.intented.testnet")).status).toBe(429);
    expect(t.asked).toHaveLength(3);
  });
});

describe("POST /api/verdict with quote_id", () => {
  it("judges the agent's transfer to the quote's deposit address with cross_chain from the stored quote", async () => {
    const t = quoteSetup();
    const q = await (await t.quote({ wallet_id: WALLET, intent: t.intent })).json();
    t.propose(0, q);

    const res = await t.verdict({ wallet_id: WALLET, proposal_id: 0, context: "402", quote_id: q.quote_id });
    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(t.judged).toHaveLength(1);
    expect(t.judged[0].crossChain).toMatchObject({ deposit_address: DEPOSIT, recipient: VENDOR, amount_out: "0.4 USDC", deadline_ms: q.deadline_ms });
    expect(t.judged[0].crossChain?.signed_quote.signature).toMatch(/^ed25519:/);
    // The receipt shows the deposit, as on the API's own path.
    expect((await (await t.app.request(`/api/proposals/${id}`)).json()).oneclick).toMatchObject({ deposit_address: DEPOSIT, status: "PENDING_DEPOSIT" });
  });
});

describe("POST /api/verdict with quote_id refuses with 409, without judging,", () => {
  type Q = { quote_id: string; deposit_address: string; token: string; amount_in: string; deadline_ms: string };
  const cases: [string, (t: ReturnType<typeof quoteSetup>, q: Q) => Promise<object> | object, RegExp][] = [
    ["an unknown quote", (t, q) => (t.propose(0, q), { quote_id: "q_0000000000000000" }), /no quote/],
    ["another wallet's quote", async (t) => {
      const other = await (await t.quote({ wallet_id: "other-bot.intented.testnet", intent: t.intent })).json();
      t.propose(0, other);
      return { quote_id: other.quote_id };
    }, /no quote/],
    ["a transfer of another amount", (t, q) => (t.propose(0, q, { args: { receiver_id: q.deposit_address, amount: "1" } }), {}), /isn't an ft_transfer/],
    ["a transfer to another account", (t, q) => (t.propose(0, q, { args: { receiver_id: "intented-attacker.testnet", amount: q.amount_in } }), {}), /isn't an ft_transfer/],
    ["a transfer of another token", (t, q) => (t.propose(0, q, { action: { receiver_id: "usdc.fakes.testnet" } }), {}), /isn't an ft_transfer/],
    ["a proposal that outlives the quote", (t, q) => (t.propose(0, q, { action: { expiry_ms: q.deadline_ms } }), {}), /before the quote's deadline/],
  ];
  for (const [what, arrange, error] of cases) {
    it(what, async () => {
      const t = quoteSetup();
      const q = await (await t.quote({ wallet_id: WALLET, intent: t.intent })).json();
      const over = await arrange(t, q);
      const res = await t.verdict({ wallet_id: WALLET, proposal_id: 0, context: "", quote_id: q.quote_id, ...over });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(error);
      expect(t.judged).toEqual([]);
    });
  }

  it("a quote past its deadline", async () => {
    const t = quoteSetup();
    const q = await (await t.quote({ wallet_id: WALLET, intent: t.intent })).json();
    t.propose(0, q, { action: { expiry_ms: String(Number(q.deadline_ms) - 1) } });
    t.clock.at = Number(q.deadline_ms);
    const res = await t.verdict({ wallet_id: WALLET, proposal_id: 0, context: "", quote_id: q.quote_id });
    expect(res.status).toBe(409);
    expect(t.judged).toEqual([]);
  });

  it("a quote already used for another proposal", async () => {
    const t = quoteSetup();
    const q = await (await t.quote({ wallet_id: WALLET, intent: t.intent })).json();
    t.propose(0, q);
    t.propose(1, q);
    expect((await t.verdict({ wallet_id: WALLET, proposal_id: 0, context: "", quote_id: q.quote_id })).status).toBe(200);
    const res = await t.verdict({ wallet_id: WALLET, proposal_id: 1, context: "", quote_id: q.quote_id });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/used for another proposal/);
    expect(t.judged).toHaveLength(1);
  });

  it("but takes the same quote again when the judge failed the first time", async () => {
    const t = quoteSetup();
    const q = await (await t.quote({ wallet_id: WALLET, intent: t.intent })).json();
    t.propose(0, q);
    t.judge.failures = 1;
    expect((await t.verdict({ wallet_id: WALLET, proposal_id: 0, context: "", quote_id: q.quote_id })).status).toBe(502);
    expect((await t.verdict({ wallet_id: WALLET, proposal_id: 0, context: "", quote_id: q.quote_id })).status).toBe(200);
  });
});
