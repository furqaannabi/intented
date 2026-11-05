// After a verdict, in the background: settles each judged proposal from its wallet's own record, and follows a
// payment through 1Click to delivery. The API sends no transactions; the wallet's agent proposes and executes.

import type { createOneClick } from "./oneclick.js";
import { settle, type Settled } from "./settle.js";
import { ONECLICK_FINAL, type ProposalRow, type Store } from "./store.js";
import type { WalletReader } from "./wallet.js";

/** How long after the quote's deadline a deposit is still followed before the pipeline stops asking. */
const TRACK_AFTER_DEADLINE_MS = 60 * 60_000;

export interface PipelineDeps {
  store: Store;
  /** A wallet's record, for settling its proposals. */
  walletFor: (walletId: string) => Pick<WalletReader, "proposalStatus">;
  /** Proposal ids, statuses and transaction hashes only: never context, prompts or keys. */
  log: (line: string) => void;
  /** How often an interrupted proposal re-reads the wallet while it could still execute. */
  recheckMs?: number;
  /** For payments through 1Click: tells 1Click about the deposit and follows it. `nearSender` is who signed execute: the wallet's agent. */
  oneclick?: { client: Pick<ReturnType<typeof createOneClick>, "submitDeposit" | "trackDeposit">; nearSender: (walletId: string) => Promise<string | undefined> };
  /** How often an executed deposit is re-read from 1Click. */
  trackMs?: number;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export function createPipeline(d: PipelineDeps) {
  const recheckMs = d.recheckMs ?? 5000;
  const trackMs = d.trackMs ?? 5000;

  function finish(p: ProposalRow, s: Settled) {
    // Keep the model's reason; a pipeline failure is added after it.
    const reason = !p.reason ? s.reason : s.status === "failed" ? `${p.reason} | ${s.reason}` : p.reason;
    d.store.updateProposal(p.id, { status: s.status, reason, step: "done" });
    d.log(`proposal ${p.id}: ${s.status}`);
    if (s.status === "executed" && p.oneclick) void trackDeposit(p.id);
  }

  /** After execute: tells 1Click about the deposit, then follows it to a final status. */
  async function trackDeposit(id: string): Promise<void> {
    if (!d.oneclick) return d.log(`proposal ${id}: no 1Click client configured; the deposit is not followed`);
    const { client, nearSender } = d.oneclick;
    let submitted = false;
    for (;;) {
      const p = d.store.getProposal(id)!;
      const oc = p.oneclick!;
      if (ONECLICK_FINAL.includes(oc.status)) return;
      if (Date.now() > Number(p.cross_chain?.deadline_ms ?? 0) + TRACK_AFTER_DEADLINE_MS) {
        return d.log(`proposal ${id}: 1Click still ${oc.status} an hour after the quote's deadline; stopped following`);
      }
      // 1Click finds a deposit by itself; telling it is faster, and the testnet stand-in needs it.
      if (!submitted && p.near_tx_hash) {
        try {
          await client.submitDeposit(oc.deposit_address, p.near_tx_hash, await nearSender(p.wallet_id));
          submitted = true;
        } catch (e) {
          d.log(`proposal ${id}: telling 1Click about the deposit failed, retrying (${errorText(e)})`);
        }
      }
      try {
        const s = await client.trackDeposit(oc.deposit_address);
        if (s.status !== oc.status || s.dest_tx_hash !== oc.dest_tx_hash) {
          d.store.updateProposal(id, { oneclick: { ...oc, status: s.status, dest_tx_hash: s.dest_tx_hash } });
          d.log(`proposal ${id}: 1Click ${s.status}${s.dest_tx_hash ? `, destination tx ${s.dest_tx_hash}` : ""}`);
        }
      } catch (e) {
        d.log(`proposal ${id}: 1Click status read failed, retrying (${errorText(e)})`);
      }
      await new Promise((r) => setTimeout(r, trackMs));
    }
  }

  /** Re-reads the wallet until the proposal's outcome is certain. */
  async function settleLoop(id: string): Promise<void> {
    for (;;) {
      const p = d.store.getProposal(id)!;
      let wallet = null;
      try {
        if (p.chain_proposal_id !== null) wallet = await d.walletFor(p.wallet_id).proposalStatus(p.chain_proposal_id);
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

  return {
    /** A proposal judged by POST /api/verdict, whose agent sends execute itself: settle it from its wallet's record. */
    settle(id: string) {
      void settleLoop(id);
    },
    /** On startup: settle every proposal a previous run left unfinished, and follow deposits still in flight. */
    recover() {
      for (const p of d.store.unsettled()) {
        d.log(`proposal ${p.id}: unfinished at ${p.step} after restart; settling`);
        void settleLoop(p.id);
      }
      for (const p of d.store.depositsInFlight()) {
        d.log(`proposal ${p.id}: 1Click deposit ${p.oneclick!.status} after restart; following it`);
        void trackDeposit(p.id);
      }
    },
  };
}
