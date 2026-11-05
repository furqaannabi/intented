import type { Judgement } from "@intented/firewall-core";
import { describe, expect, it } from "vitest";
import { createPipeline, type PipelineDeps } from "../src/pipeline.js";
import type { WalletStatus } from "../src/settle.js";
import { openStore } from "../src/store.js";

const HASH = "a".repeat(64);
const WALLET = "shop-bot.intented.testnet";
const verdict = (v: "ALLOW" | "DENY"): Judgement => ({
  verdict: v, reason: `model says ${v}`, model: "m", chat_id: "chat-1", req_bytes: new Uint8Array([1]), resp_bytes: new Uint8Array([2]), signature: "0xsig", signer: "0xsigner",
});
const action = (nonce = "1") => ({ receiver_id: "wrap.testnet", method: "ft_transfer", args_sha256: "b".repeat(64), deposit: "1", nonce, expiry_ms: String(Date.now() + 60_000) });

describe("pipeline: settling a judged proposal", () => {
  function setup(walletStatus: WalletStatus) {
    const store = openStore(":memory:");
    const m = store.createMandate("Buy market data", HASH);
    const read: string[] = [];
    const pipeline = createPipeline({
      store,
      walletFor: (id) => ({ proposalStatus: async (pid) => (read.push(`${id} ${pid}`), walletStatus) }),
      log: () => {},
      recheckMs: 5,
    });
    const p = store.createProposal({ mandate_id: m.id, action: action(), args: "{}", context: "", wallet_id: WALLET, chain_proposal_id: 3 });
    const done = async () => {
      for (let i = 0; i < 200 && store.getProposal(p.id)!.step !== "done"; i++) await new Promise((r) => setTimeout(r, 5));
      return store.getProposal(p.id)!;
    };
    return { store, pipeline, p, read, done };
  }

  it("settles a judged proposal from its own wallet's record, keeping the model's reason", async () => {
    const t = setup("executed");
    t.store.updateProposal(t.p.id, { ...verdict("ALLOW"), status: "allowed", step: "execute" });
    t.pipeline.settle(t.p.id);
    const r = await t.done();
    expect([r.status, r.reason, t.read[0]]).toEqual(["executed", "model says ALLOW", `${WALLET} 3`]);
  });

  it("settles a DENY as denied", async () => {
    const t = setup("pending");
    t.store.updateProposal(t.p.id, { ...verdict("DENY"), status: "denied", step: "execute" });
    t.pipeline.settle(t.p.id);
    expect((await t.done()).status).toBe("denied");
  });

  it("on restart, fails a proposal stored before its verdict", async () => {
    const t = setup(null);
    t.pipeline.recover();
    expect((await t.done()).status).toBe("failed");
  });
});

describe("pipeline: a payment through 1Click", () => {
  const crossChain = {
    deposit_address: "intented-1click.testnet", dest_chain: "base", dest_asset: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    recipient: "0x7284d41b5b852f2bd4c99bdf95043d84452d299c", amount_out: "0.4 USDC", deadline_ms: String(Date.now() + 30 * 60_000),
    signed_quote: { payload: "{}", signature: "ed25519:1" },
  };
  const oneclick = { deposit_address: crossChain.deposit_address, dest_chain: "base", recipient: crossChain.recipient, amount_out: "0.4 USDC", status: "PENDING_DEPOSIT", simulated: true };

  function setup(statuses: { status: "PROCESSING" | "SUCCESS"; dest_tx_hash?: string }[] = [{ status: "PROCESSING" }, { status: "SUCCESS", dest_tx_hash: "0xbase" }]) {
    const store = openStore(":memory:");
    const m = store.createMandate("Buy market data", HASH);
    const submitted: unknown[][] = [];
    const left = [...statuses];
    const deps: PipelineDeps = {
      store,
      walletFor: () => ({ proposalStatus: async () => "executed" }),
      log: () => {},
      recheckMs: 5,
      trackMs: 5,
      oneclick: {
        nearSender: async (walletId) => walletId,
        client: {
          submitDeposit: async (...a) => void submitted.push(a),
          trackDeposit: async () => left.shift() ?? { status: "SUCCESS", dest_tx_hash: "0xbase" },
        },
      },
    };
    const p = store.createProposal({ mandate_id: m.id, action: action(), args: "{}", context: "", cross_chain: crossChain, oneclick, wallet_id: WALLET, chain_proposal_id: 3 });
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 5));
      return store.getProposal(p.id)!;
    };
    return { store, deps, p, submitted, until };
  }

  it("tells 1Click once the agent reports its execute, signed by that wallet's agent, and follows it to SUCCESS", async () => {
    const { deps, store, p, submitted, until } = setup([...Array.from({ length: 10 }, () => ({ status: "PROCESSING" as const }))]);
    store.updateProposal(p.id, { ...verdict("ALLOW"), status: "allowed", step: "execute" });
    createPipeline(deps).settle(p.id);
    await until(() => store.getProposal(p.id)!.status === "executed");
    await new Promise((r) => setTimeout(r, 20));
    expect(submitted).toEqual([]);
    // POST /api/executed stores the hash; the follower picks it up.
    store.updateProposal(p.id, { near_tx_hash: "agent-etx" });
    const done = await until(() => store.getProposal(p.id)!.oneclick?.status === "SUCCESS");
    expect(submitted).toEqual([[crossChain.deposit_address, "agent-etx", WALLET]]);
    expect(done.oneclick).toEqual({ ...oneclick, status: "SUCCESS", dest_tx_hash: "0xbase" });
  });

  it("never tells 1Click about a deposit after a DENY", async () => {
    const { deps, store, p, submitted, until } = setup();
    store.updateProposal(p.id, { ...verdict("DENY"), status: "denied", step: "execute", near_tx_hash: "refused-etx" });
    createPipeline({ ...deps, walletFor: () => ({ proposalStatus: async () => "pending" }) }).settle(p.id);
    const done = await until(() => store.getProposal(p.id)!.step === "done");
    await new Promise((r) => setTimeout(r, 30));
    expect(done.status).toBe("denied");
    expect(submitted).toEqual([]);
    expect(store.getProposal(p.id)!.oneclick?.status).toBe("PENDING_DEPOSIT");
  });

  it("after a restart, follows an executed deposit that hadn't finished", async () => {
    const { deps, p, until, store } = setup();
    store.updateProposal(p.id, { status: "executed", step: "done", near_tx_hash: "etx" });
    createPipeline(deps).recover();
    const done = await until(() => store.getProposal(p.id)!.oneclick?.status === "SUCCESS");
    expect(done.oneclick?.dest_tx_hash).toBe("0xbase");
  });
});
