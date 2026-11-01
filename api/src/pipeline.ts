// judge -> propose -> execute for one proposal, in the background
// (decisions/2026-11-01-api-pipeline-behaviour.md). Each step's result is stored
// as it happens, so an interruption is settled from facts, never guessed.

import type { Judgement } from "@intented/firewall-core";
import { settle, type Settled } from "./settle.js";
import type { ProposalRow, Store } from "./store.js";
import { toAction } from "./validate.js";
import type { WalletConfig, WalletReader } from "./wallet.js";

type Action = ReturnType<typeof toAction>;

export interface PipelineDeps {
  store: Store;
  judge: (mandateText: string, action: Action, argsJson: string, context: string) => Promise<Judgement>;
  chain: {
    proposeOnChain(action: Action, argsJson: string): Promise<{ proposal_id: number; near_tx_hash: string }>;
    executeOnChain(proposalId: number, req: Uint8Array, resp: Uint8Array, sig: string): Promise<{ near_tx_hash: string; ok: boolean; error?: string }>;
  };
  wallet: Pick<WalletReader, "config" | "proposalStatus">;
  /** What this API judges with; the wallet refuses a verdict from any other model or prompt. */
  expected: { model: string; promptHash: string };
  /** Proposal ids, statuses and transaction hashes only: never context, prompts or keys. */
  log: (line: string) => void;
  /** How often an interrupted proposal re-reads the wallet while it could still execute. */
  recheckMs?: number;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export function createPipeline(d: PipelineDeps) {
  const recheckMs = d.recheckMs ?? 5000;

  // On-chain steps run one proposal at a time, so two transactions never race for the agent key's nonce.
  let chainTail: Promise<unknown> = Promise.resolve();
  function onChain<T>(fn: () => Promise<T>): Promise<T> {
    const next = chainTail.then(fn, fn);
    chainTail = next.catch(() => undefined);
    return next;
  }

  function finish(p: ProposalRow, s: Settled) {
    // Keep the model's reason; a pipeline failure is added after it.
    const reason = !p.reason ? s.reason : s.status === "failed" ? `${p.reason} | ${s.reason}` : p.reason;
    d.store.updateProposal(p.id, { status: s.status, reason, step: "done" });
    d.log(`proposal ${p.id}: ${s.status}`);
  }

  /** Re-reads the wallet until the proposal's outcome is certain. */
  async function settleLoop(id: string): Promise<void> {
    for (;;) {
      const p = d.store.getProposal(id)!;
      let wallet = null;
      try {
        if (p.chain_proposal_id !== null) wallet = await d.wallet.proposalStatus(p.chain_proposal_id);
      } catch (e) {
        d.log(`proposal ${id}: wallet read failed, retrying (${errorText(e)})`);
        await new Promise((r) => setTimeout(r, recheckMs));
        continue;
      }
      const s = settle({ verdict: p.verdict, chain_proposal_id: p.chain_proposal_id, expiry_ms: Number(p.action.expiry_ms) }, wallet, Date.now());
      if (s !== "wait") return finish(p, s);
      await new Promise((r) => setTimeout(r, recheckMs));
    }
  }

  async function run(id: string): Promise<void> {
    const p = d.store.getProposal(id)!;
    const mandate = d.store.getMandate(p.mandate_id)!;
    const action = toAction(p.action);

    // 1. The wallet refuses a verdict under any other mandate, model or prompt; fail before spending a NEAR AI call.
    let w: WalletConfig;
    try {
      w = await d.wallet.config();
    } catch (e) {
      return finish(p, { status: "failed", reason: `pipeline: could not read the wallet's config (${errorText(e)})` });
    }
    if (w.mandate_hash !== mandate.text_hash) return finish(p, { status: "failed", reason: "pipeline: this mandate is not active on the wallet" });
    if (w.model_id !== d.expected.model) return finish(p, { status: "failed", reason: `pipeline: the wallet runs model ${w.model_id ?? "(none)"}, not ${d.expected.model}` });
    if (w.prompt_hash !== d.expected.promptHash) return finish(p, { status: "failed", reason: "pipeline: the wallet expects a different prompt than this API's firewall core" });

    // 2. The verdict. No verdict, no transactions.
    let v: Judgement;
    try {
      v = await d.judge(mandate.text, action, p.args, p.context);
    } catch (e) {
      return finish(p, { status: "failed", reason: `pipeline: no verdict (${errorText(e)})` });
    }
    d.store.updateProposal(id, {
      verdict: v.verdict, reason: v.reason, model: v.model, chat_id: v.chat_id, signature: v.signature, signer: v.signer,
      req_bytes: v.req_bytes, resp_bytes: v.resp_bytes, status: v.verdict === "ALLOW" ? "allowed" : "denied", step: "propose",
    });
    d.log(`proposal ${id}: ${v.verdict} (chat ${v.chat_id})`);

    // 3. On-chain, DENY included: the wallet's refusal is the proof.
    await onChain(async () => {
      try {
        const pr = await d.chain.proposeOnChain(action, p.args);
        d.store.updateProposal(id, { chain_proposal_id: pr.proposal_id, propose_tx_hash: pr.near_tx_hash, step: "execute" });
        d.log(`proposal ${id}: on-chain ${pr.proposal_id}, propose tx ${pr.near_tx_hash}`);
      } catch (e) {
        d.log(`proposal ${id}: propose threw (${errorText(e)})`);
        return settleLoop(id);
      }
      const chainId = d.store.getProposal(id)!.chain_proposal_id!;
      try {
        const e = await d.chain.executeOnChain(chainId, v.req_bytes, v.resp_bytes, v.signature);
        d.store.updateProposal(id, { near_tx_hash: e.near_tx_hash });
        d.log(`proposal ${id}: execute tx ${e.near_tx_hash}, ok=${e.ok}`);
        const now = d.store.getProposal(id)!;
        if (e.ok) return finish(now, { status: "executed", reason: "" });
        if (v.verdict === "DENY") return finish(now, { status: "denied", reason: "" });
        return finish(now, { status: "failed", reason: `pipeline: execute failed (${e.error ?? "unknown"})` });
      } catch (e) {
        // The call may have gone through; only the wallet's record can say.
        d.log(`proposal ${id}: execute threw (${errorText(e)}); settling from the wallet's record`);
        return settleLoop(id);
      }
    });
  }

  return {
    start(id: string) {
      run(id).catch((e) => {
        d.log(`proposal ${id}: pipeline error (${errorText(e)}); settling from the wallet's record`);
        void settleLoop(id);
      });
    },
    /** On startup: settle every proposal a previous run left unfinished. Never resumes the pipeline. */
    recover() {
      for (const p of d.store.unsettled()) {
        d.log(`proposal ${p.id}: unfinished at ${p.step} after restart; settling`);
        void settleLoop(p.id);
      }
    },
  };
}
