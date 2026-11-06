import { createHash } from "node:crypto";
import type { Judgement } from "@intented/firewall-core";
import { describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/app.js";
import { openStore } from "../src/store.js";
import type { ChainTx } from "../src/wallet.js";

const WALLET = "shop-bot.intented.testnet";
const RULES = "Buy market data from intented-vendor.testnet only.";
const RULES_HASH = createHash("sha256").update(RULES, "utf8").digest("hex");
const ARGS_JSON = JSON.stringify({ receiver_id: "intented-vendor.testnet", amount: "1000000000000000000000" });

/** A wallet as get_config and get_proposal show it, with one pending proposal (id 0) the agent made itself. */
function chainWallet(now: number) {
  const args_json = ARGS_JSON;
  return {
    config: { frozen: false, mandate_hash: RULES_HASH, model_id: "m", prompt_hash: "p", agent_id: WALLET as string },
    proposals: new Map<number, unknown>([
      [
        0,
        {
          action: {
            receiver_id: "wrap.testnet", method: "ft_transfer", args_sha256: createHash("sha256").update(args_json).digest("hex"),
            deposit: "1", nonce: String(now), expiry_ms: String(now + 15 * 60_000),
          },
          args_json,
          status: "pending",
        },
      ],
    ]),
  };
}

function setup(opts: { limit?: AppDeps["verdicts"] extends infer V ? NonNullable<V>["limit"] : never; factoryId?: string | null } = {}) {
  const now = Date.now();
  const store = openStore(":memory:");
  store.createMandate(RULES, RULES_HASH);
  const wallets = new Map([[WALLET, chainWallet(now)]]);
  const judged: { mandate: string; argsJson: string; context: string }[] = [];
  const settling: string[] = [];
  const judge = { failures: 0, verdict: "ALLOW" as "ALLOW" | "DENY" };
  /** Transactions on chain by hash, as the RPC's tx lookup returns them. */
  const txs = new Map<string, ChainTx>();
  const verdicts: AppDeps["verdicts"] = {
    judge: async (mandate, action, argsJson, context): Promise<Judgement> => {
      judged.push({ mandate, argsJson, context });
      if (judge.failures-- > 0) throw new Error("NEAR AI timed out");
      return {
        verdict: judge.verdict, reason: "matches the rules", model: "m", chat_id: "chat-1", signer: "0xsigner", signature: "0xsig",
        req_bytes: new Uint8Array([1, 2, 3]), resp_bytes: new Uint8Array([4, 5]),
      };
    },
    readWallet: (id) => ({
      config: async () => {
        const w = wallets.get(id);
        if (!w) throw new Error(`no account ${id}`);
        return w.config;
      },
      proposal: async (pid) => (wallets.get(id)?.proposals.get(pid) ?? null) as never,
    }),
    expected: { model: "m", promptHash: "p" },
    factoryId: opts.factoryId === undefined ? "intented.testnet" : (opts.factoryId ?? undefined),
    ownWalletId: "intented-wallet.testnet",
    settle: (id) => settling.push(id),
    readTx: async (hash, signerId) => {
      const t = txs.get(hash);
      return t && t.signer_id === signerId ? t : null;
    },
    limit: opts.limit,
  };
  const app = createApp({
    store, network: "testnet", model: "m", attestationUrls: {}, redteam: () => null, verdicts, now: () => now,
  });
  const ask = (body: object) => app.request("/api/verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const executed = (body: object) => app.request("/api/executed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ask, judged, settling, store, wallets, now, judge, app, txs, executed };
}

describe("POST /api/verdict", () => {
  it("judges the wallet's pending proposal, read from the chain, and returns the verdict ready for execute", async () => {
    const { ask, judged, settling } = setup();
    const res = await ask({ wallet_id: WALLET, proposal_id: 0, context: "402: pay 0.001 wNEAR" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      verdict: "ALLOW", reason: "matches the rules", model: "m", chat_id: "chat-1", signer: "0xsigner", signature: "0xsig",
      req_bytes: Buffer.from([1, 2, 3]).toString("base64"), resp_bytes: Buffer.from([4, 5]).toString("base64"),
    });
    expect(body.id).toMatch(/^p_/);
    // The rules are the wallet's own, by hash; the action is the one on the chain, not anything the caller sent.
    expect(judged).toEqual([{ mandate: RULES, argsJson: ARGS_JSON, context: "402: pay 0.001 wNEAR" }]);
    expect(settling).toEqual([body.id]);
  });

  // Each refusal comes before the NEAR AI call: nothing is judged, nothing is stored.
  const refusals: [string, (w: ReturnType<typeof chainWallet>, now: number) => void, RegExp][] = [
    ["the wallet is frozen", (w) => (w.config.frozen = true), /frozen/],
    ["the wallet expects another model", (w) => (w.config.model_id = "other"), /model/],
    ["the wallet expects another prompt", (w) => (w.config.prompt_hash = "other"), /prompt/],
    ["the wallet has no rules set", (w) => (w.config.mandate_hash = null), /rules/],
    ["the API doesn't hold the wallet's rules", (w) => (w.config.mandate_hash = "f".repeat(64)), /rules/],
    ["the proposal doesn't exist", (w) => w.proposals.delete(0), /no proposal/],
    ["the proposal was executed already", (w) => ((w.proposals.get(0) as { status: string }).status = "executed"), /executed/],
    ["the proposal has under a minute left", (w, now) => ((w.proposals.get(0) as { action: { expiry_ms: string } }).action.expiry_ms = String(now + 59_000)), /expires/],
  ];
  it("answers 400 for a wallet the factory didn't make, a bad proposal id or a missing context", async () => {
    const { ask, judged } = setup();
    for (const body of [
      { wallet_id: "evil.testnet", proposal_id: 0, context: "" },
      { wallet_id: "a.b.intented.testnet", proposal_id: 0, context: "" },
      { wallet_id: WALLET, proposal_id: -1, context: "" },
      { wallet_id: WALLET, proposal_id: "0", context: "" },
      { wallet_id: WALLET, proposal_id: 0 },
    ]) expect((await ask(body)).status, JSON.stringify(body)).toBe(400);
    expect(judged).toEqual([]);
  });

  it("with no factory (mainnet), judges only its own wallet", async () => {
    const { ask, judged, wallets, now } = setup({ factoryId: null });
    wallets.set("intented-wallet.testnet", chainWallet(now));
    const factoryWallet = await ask({ wallet_id: WALLET, proposal_id: 0, context: "" });
    expect([factoryWallet.status, (await factoryWallet.json()).error]).toEqual([400, "wallet_id must be intented-wallet.testnet"]);
    expect(judged).toEqual([]);
    expect((await ask({ wallet_id: "intented-wallet.testnet", proposal_id: 0, context: "" })).status).toBe(200);
  });

  it("judges each proposal once: asking again, even at the same time, returns the same verdict", async () => {
    const { ask, judged, settling } = setup();
    const body = { wallet_id: WALLET, proposal_id: 0, context: "402: pay" };
    const [a, b] = await Promise.all([ask(body), ask(body)]);
    const c = await ask({ ...body, context: "a different story" });
    const [ja, jb, jc] = await Promise.all([a.json(), b.json(), c.json()]);
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(jb).toEqual(ja);
    expect(jc).toEqual(ja);
    expect(judged).toHaveLength(1);
    expect(settling).toEqual([ja.id]);
  });

  it("judges at most `perClient` proposals per wallet per window, then answers 429 with Retry-After", async () => {
    const { ask, judged, wallets } = setup({ limit: { perClient: 2, total: 10, windowMs: 60 * 60_000 } });
    const w = wallets.get(WALLET)!;
    const first = w.proposals.get(0) as { action: { nonce: string } };
    for (const id of [1, 2]) w.proposals.set(id, { ...first, action: { ...first.action, nonce: String(BigInt(first.action.nonce) + BigInt(id)) } });

    expect((await ask({ wallet_id: WALLET, proposal_id: 0, context: "" })).status).toBe(200);
    expect((await ask({ wallet_id: WALLET, proposal_id: 1, context: "" })).status).toBe(200);
    const res = await ask({ wallet_id: WALLET, proposal_id: 2, context: "" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(judged).toHaveLength(2);
    // A verdict already given isn't a new judgement, so it's still answered.
    expect((await ask({ wallet_id: WALLET, proposal_id: 0, context: "" })).status).toBe(200);
  });

  it("answers 502 when the judge fails, and judges the proposal again when asked again", async () => {
    const { ask, judge, judged, settling, store } = setup();
    judge.failures = 1;
    const failed = await ask({ wallet_id: WALLET, proposal_id: 0, context: "" });
    expect(failed.status).toBe(502);
    expect(store.proposalsSince(0).map((p) => p.status)).toEqual(["failed"]);
    expect(settling).toEqual([]);

    const res = await ask({ wallet_id: WALLET, proposal_id: 0, context: "" });
    expect(res.status).toBe(200);
    expect(judged).toHaveLength(2);
  });

  it("lists the judged proposal in the feed with its wallet, and ?wallet= lists only that wallet's", async () => {
    const { ask, store, app } = setup();
    const m = store.getMandateByHash(RULES_HASH)!;
    store.createProposal({ mandate_id: m.id, action: { receiver_id: "a", method: "b", args_sha256: "c", deposit: "1", nonce: "1", expiry_ms: "1" }, args: "{}", context: "" });
    const { id } = await (await ask({ wallet_id: WALLET, proposal_id: 0, context: "" })).json();

    const all = await (await app.request("/api/proposals")).json();
    expect(all.map((p: { wallet_id: string }) => p.wallet_id)).toEqual(["intented-wallet.testnet", WALLET]);
    const mine = await (await app.request(`/api/proposals?wallet=${WALLET}`)).json();
    expect(mine.map((p: { id: string }) => p.id)).toEqual([id]);
  });

  it("answers 502 when the wallet can't be read", async () => {
    const { ask, judged } = setup();
    const res = await ask({ wallet_id: "nobody.intented.testnet", proposal_id: 0, context: "" });
    expect(res.status).toBe(502);
    expect(judged).toEqual([]);
  });

  for (const [what, change, error] of refusals) {
    it(`answers 409 without judging when ${what}`, async () => {
      const { ask, judged, store, wallets, now } = setup();
      change(wallets.get(WALLET)!, now);
      const res = await ask({ wallet_id: WALLET, proposal_id: 0, context: "" });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(error);
      expect(judged).toEqual([]);
      expect(store.proposalsSince(0)).toEqual([]);
    });
  }
});

describe("POST /api/executed", () => {
  const HASH = "4rddy8CUvMfzJjxVALZdMPNmZ7W8ofKB5KERee66X2og";
  const executeTx = (over: Partial<ChainTx> = {}): ChainTx => ({
    signer_id: WALLET, receiver_id: WALLET, ok: true, calls: [{ method: "execute", args: { proposal_id: 0, req_bytes: [], resp_bytes: [], signature: "0xsig" } }], ...over,
  });

  it("checks the agent's execute on chain and stores its hash on the judged proposal", async () => {
    const t = setup();
    const { id } = await (await t.ask({ wallet_id: WALLET, proposal_id: 0, context: "" })).json();
    t.txs.set(HASH, executeTx());

    const res = await t.executed({ wallet_id: WALLET, proposal_id: 0, near_tx_hash: HASH });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id });
    expect((await (await t.app.request(`/api/proposals/${id}`)).json()).near_tx_hash).toBe(HASH);
  });

  it("answers 404 for a proposal this API didn't judge", async () => {
    const t = setup();
    t.txs.set(HASH, executeTx());
    expect((await t.executed({ wallet_id: WALLET, proposal_id: 0, near_tx_hash: HASH })).status).toBe(404);
  });

  it("answers 400 for a malformed body", async () => {
    const t = setup();
    for (const body of [
      { wallet_id: "evil.testnet", proposal_id: 0, near_tx_hash: HASH },
      { wallet_id: WALLET, proposal_id: -1, near_tx_hash: HASH },
      { wallet_id: WALLET, proposal_id: 0, near_tx_hash: "not a hash" },
      { wallet_id: WALLET, proposal_id: 0 },
    ]) expect((await t.executed(body)).status, JSON.stringify(body)).toBe(400);
  });

  const wrong: [string, Partial<ChainTx> | null][] = [
    ["isn't on chain, or another account signed it", null],
    ["called another contract", { receiver_id: "other.testnet" }],
    ["called another method", { calls: [{ method: "propose", args: { proposal_id: 0 } }] }],
    ["executed another proposal", { calls: [{ method: "execute", args: { proposal_id: 1 } }] }],
    ["failed, on an ALLOW", { ok: false }],
  ];
  for (const [what, over] of wrong) {
    it(`answers 409 and stores nothing when the transaction ${what}`, async () => {
      const t = setup();
      const { id } = await (await t.ask({ wallet_id: WALLET, proposal_id: 0, context: "" })).json();
      if (over) t.txs.set(HASH, executeTx(over));
      const res = await t.executed({ wallet_id: WALLET, proposal_id: 0, near_tx_hash: HASH });
      expect(res.status).toBe(409);
      expect((await (await t.app.request(`/api/proposals/${id}`)).json()).near_tx_hash).toBeUndefined();
    });
  }

  it("stores the wallet's refused execute of a DENY, so the receipt links the refusal on chain", async () => {
    const t = setup();
    t.judge.verdict = "DENY";
    const { id } = await (await t.ask({ wallet_id: WALLET, proposal_id: 0, context: "" })).json();
    t.txs.set(HASH, executeTx({ ok: false }));
    const res = await t.executed({ wallet_id: WALLET, proposal_id: 0, near_tx_hash: HASH });
    expect(res.status).toBe(200);
    expect((await (await t.app.request(`/api/proposals/${id}`)).json()).near_tx_hash).toBe(HASH);
  });
});
