import type { Judgement } from "@intented/firewall-core";
import { describe, expect, it } from "vitest";
import { createPipeline, type PipelineDeps } from "../src/pipeline.js";
import type { WalletStatus } from "../src/settle.js";
import { openStore } from "../src/store.js";

const HASH = "a".repeat(64);
const PROMPT = "d".repeat(64);
const wallet = (over: { mandate_hash?: string; model_id?: string; prompt_hash?: string } = {}) => ({ mandate_hash: HASH, model_id: "m", prompt_hash: PROMPT, ...over });
const verdict = (v: "ALLOW" | "DENY"): Judgement => ({
  verdict: v, reason: `model says ${v}`, model: "m", chat_id: "chat-1", req_bytes: new Uint8Array([1]), resp_bytes: new Uint8Array([2]), signature: "0xsig", signer: "0xsigner",
});

function setup(over: { judge?: PipelineDeps["judge"]; execute?: PipelineDeps["chain"]["executeOnChain"]; config?: Parameters<typeof wallet>[0]; walletStatus?: WalletStatus } = {}) {
  const store = openStore(":memory:");
  const m = store.createMandate("Buy market data", HASH);
  const calls: string[] = [];
  const pipeline = createPipeline({
    store,
    judge: over.judge ?? (async () => verdict("ALLOW")),
    chain: {
      proposeOnChain: async () => (calls.push("propose"), { proposal_id: 7, near_tx_hash: "ptx" }),
      executeOnChain: over.execute ?? (async () => (calls.push("execute"), { near_tx_hash: "etx", ok: true })),
    },
    wallet: { config: async () => wallet(over.config), proposalStatus: async () => over.walletStatus ?? null },
    expected: { model: "m", promptHash: PROMPT },
    log: () => {},
    recheckMs: 5,
  });
  const action = { receiver_id: "wrap.testnet", method: "ft_transfer", args_sha256: "b".repeat(64), deposit: "1", nonce: "1", expiry_ms: String(Date.now() + 60_000) };
  const p = store.createProposal({ mandate_id: m.id, action, args: "{}", context: "" });
  const done = async () => {
    for (let i = 0; i < 200 && store.getProposal(p.id)!.step !== "done"; i++) await new Promise((r) => setTimeout(r, 5));
    return store.getProposal(p.id)!;
  };
  return { store, pipeline, p, calls, done };
}

describe("pipeline", () => {
  it("executes an ALLOW and stores the execute hash", async () => {
    const t = setup();
    t.pipeline.start(t.p.id);
    const r = await t.done();
    expect([r.status, r.near_tx_hash, r.propose_tx_hash, r.reason]).toEqual(["executed", "etx", "ptx", "model says ALLOW"]);
  });

  it("still sends a DENY on-chain, and records it as denied with the refused execute's hash", async () => {
    const t = setup({ judge: async () => verdict("DENY"), execute: async () => ({ near_tx_hash: "refused", ok: false, error: "verdict is not ALLOW" }) });
    t.pipeline.start(t.p.id);
    const r = await t.done();
    expect([r.status, r.near_tx_hash, r.reason]).toEqual(["denied", "refused", "model says DENY"]);
  });

  it("fails without judging or transacting when the mandate is not active on the wallet", async () => {
    let judged = false;
    const t = setup({ config: { mandate_hash: "c".repeat(64) }, judge: async () => ((judged = true), verdict("ALLOW")) });
    t.pipeline.start(t.p.id);
    const r = await t.done();
    expect([r.status, judged, t.calls]).toEqual(["failed", false, []]);
  });

  it("fails without judging when the wallet expects another prompt or model", async () => {
    for (const config of [{ prompt_hash: "e".repeat(64) }, { model_id: "other/model" }]) {
      let judged = false;
      const t = setup({ config, judge: async () => ((judged = true), verdict("ALLOW")) });
      t.pipeline.start(t.p.id);
      const r = await t.done();
      expect([r.status, judged, t.calls]).toEqual(["failed", false, []]);
      expect(r.reason).toMatch(/^pipeline: the wallet (expects a different prompt|runs model other\/model)/);
    }
  });

  it("fails without transacting when there is no verdict", async () => {
    const t = setup({ judge: async () => { throw new Error("NEAR AI 503"); } });
    t.pipeline.start(t.p.id);
    const r = await t.done();
    expect([r.status, t.calls, r.reason]).toEqual(["failed", [], "pipeline: no verdict (NEAR AI 503)"]);
  });

  it("marks executed, not failed, when execute throws but the wallet executed it", async () => {
    const t = setup({ execute: async () => { throw new Error("RPC timeout"); }, walletStatus: "executed" });
    t.pipeline.start(t.p.id);
    expect((await t.done()).status).toBe("executed");
  });

  it("on restart, fails a proposal stuck before its verdict and never resumes it", async () => {
    const t = setup();
    t.pipeline.recover();
    const r = await t.done();
    expect([r.status, t.calls]).toEqual(["failed", []]);
  });

  it("sends one proposal's transactions at a time, so they never race for the agent key's nonce", async () => {
    const store = openStore(":memory:");
    const m = store.createMandate("Buy market data", HASH);
    const events: string[] = [];
    let n = 0;
    const pipeline = createPipeline({
      store,
      judge: async () => verdict("ALLOW"),
      chain: {
        proposeOnChain: async () => (events.push("propose"), { proposal_id: n++, near_tx_hash: "ptx" }),
        executeOnChain: async (id) => {
          events.push(`execute ${id} start`);
          await new Promise((r) => setTimeout(r, 30));
          events.push(`execute ${id} end`);
          return { near_tx_hash: "etx", ok: true };
        },
      },
      wallet: { config: async () => wallet(), proposalStatus: async () => null },
      expected: { model: "m", promptHash: PROMPT },
      log: () => {},
    });
    const action = { receiver_id: "wrap.testnet", method: "ft_transfer", args_sha256: "b".repeat(64), deposit: "1", nonce: "1", expiry_ms: String(Date.now() + 60_000) };
    const ids = [0, 1].map(() => store.createProposal({ mandate_id: m.id, action, args: "{}", context: "" }).id);
    ids.forEach((id) => pipeline.start(id));
    for (let i = 0; i < 200 && ids.some((id) => store.getProposal(id)!.step !== "done"); i++) await new Promise((r) => setTimeout(r, 5));
    expect(events).toEqual(["propose", "execute 0 start", "execute 0 end", "propose", "execute 1 start", "execute 1 end"]);
  });
});

describe("pipeline: a payment through 1Click", () => {
  const crossChain = {
    deposit_address: "intented-1click.testnet", dest_chain: "base", dest_asset: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    recipient: "0x7284d41b5b852f2bd4c99bdf95043d84452d299c", amount_out: "0.4 USDC", deadline_ms: String(Date.now() + 30 * 60_000),
  };
  const oneclick = { deposit_address: crossChain.deposit_address, dest_chain: "base", recipient: crossChain.recipient, amount_out: "0.4 USDC", status: "PENDING_DEPOSIT", simulated: true };

  function setupCrossChain(over: { judge?: PipelineDeps["judge"]; statuses?: { status: "PROCESSING" | "SUCCESS"; dest_tx_hash?: string }[] } = {}) {
    const store = openStore(":memory:");
    const m = store.createMandate("Buy market data", HASH);
    const judged: unknown[][] = [];
    const submitted: unknown[][] = [];
    const statuses = [...(over.statuses ?? [{ status: "PROCESSING" }, { status: "SUCCESS", dest_tx_hash: "0xbase" }])];
    const deps: PipelineDeps = {
      store,
      judge: over.judge ?? (async (...a) => (judged.push(a), verdict("ALLOW"))),
      chain: { proposeOnChain: async () => ({ proposal_id: 7, near_tx_hash: "ptx" }), executeOnChain: async () => ({ near_tx_hash: "etx", ok: true }) },
      wallet: { config: async () => wallet(), proposalStatus: async () => null },
      expected: { model: "m", promptHash: PROMPT },
      log: () => {},
      recheckMs: 5,
      trackMs: 5,
      oneclick: {
        nearSender: "intented-agent.testnet",
        client: {
          submitDeposit: async (...a) => void submitted.push(a),
          trackDeposit: async () => statuses.shift() ?? { status: "SUCCESS", dest_tx_hash: "0xbase" },
        },
      },
    };
    const action = { receiver_id: "wrap.testnet", method: "ft_transfer", args_sha256: "b".repeat(64), deposit: "1", nonce: "1", expiry_ms: String(Date.now() + 60_000) };
    const p = store.createProposal({ mandate_id: m.id, action, args: "{}", context: "", cross_chain: crossChain, oneclick });
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 5));
      return store.getProposal(p.id)!;
    };
    return { store, deps, p, judged, submitted, until };
  }

  it("gives the judge the cross_chain field", async () => {
    const { deps, p, judged, until, store } = setupCrossChain();
    createPipeline(deps).start(p.id);
    await until(() => store.getProposal(p.id)!.step === "done");
    expect(judged[0]?.[4]).toEqual(crossChain);
  });

  it("after execute, tells 1Click the deposit's transaction and follows it to SUCCESS", async () => {
    const { deps, p, submitted, until, store } = setupCrossChain();
    createPipeline(deps).start(p.id);
    const done = await until(() => store.getProposal(p.id)!.oneclick?.status === "SUCCESS");
    expect(done.status).toBe("executed");
    expect(submitted).toEqual([[crossChain.deposit_address, "etx", "intented-agent.testnet"]]);
    expect(done.oneclick).toEqual({ ...oneclick, status: "SUCCESS", dest_tx_hash: "0xbase" });
  });

  it("never tells 1Click about a deposit after a DENY", async () => {
    const { deps, p, submitted, until, store } = setupCrossChain({ judge: async () => verdict("DENY") });
    deps.chain.executeOnChain = async () => ({ near_tx_hash: "etx", ok: false, error: "verdict is not ALLOW" });
    createPipeline(deps).start(p.id);
    const done = await until(() => store.getProposal(p.id)!.step === "done");
    await new Promise((r) => setTimeout(r, 30));
    expect(done.status).toBe("denied");
    expect(submitted).toEqual([]);
    expect(store.getProposal(p.id)!.oneclick?.status).toBe("PENDING_DEPOSIT");
  });

  it("after a restart, follows an executed deposit that hadn't finished", async () => {
    const { deps, p, until, store } = setupCrossChain();
    store.updateProposal(p.id, { status: "executed", step: "done", near_tx_hash: "etx" });
    createPipeline(deps).recover();
    const done = await until(() => store.getProposal(p.id)!.oneclick?.status === "SUCCESS");
    expect(done.oneclick?.dest_tx_hash).toBe("0xbase");
  });
});
