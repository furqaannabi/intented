// Free view calls on the wallet contract over NEAR JSON-RPC: what it accepts
// verdicts under, and its own record of a proposal for settling interruptions.

import type { WalletStatus } from "./settle.js";
import type { ActionJson } from "./store.js";

/** What the wallet accepts verdicts under: each is null until the owner sets it. */
export interface WalletConfig {
  frozen: boolean;
  /** The account whose key may propose and execute: the wallet itself for factory wallets. */
  agent_id: string | null;
  mandate_hash: string | null;
  model_id: string | null;
  prompt_hash: string | null;
  /** Payments through 1Click: the owner's switch, the recipients allowed (empty: any), and the key quotes must be signed with. */
  cross_chain_enabled: boolean;
  cross_chain_recipients: string[];
  one_click_key: string | null;
}

export function createWalletReader(rpcUrl: string, walletId: string) {
  async function view<T>(method: string, args: object): Promise<T> {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "intented-api",
        method: "query",
        params: { request_type: "call_function", finality: "final", account_id: walletId, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (body.error || body.result?.error) throw new Error(`view ${method} failed: ${JSON.stringify(body.error ?? body.result.error).slice(0, 200)}`);
    return JSON.parse(Buffer.from(body.result.result).toString("utf8")) as T;
  }

  return {
    async config(): Promise<WalletConfig> {
      const c = await view<Partial<WalletConfig>>("get_config", {});
      return { frozen: c.frozen ?? false, agent_id: c.agent_id ?? null, mandate_hash: c.mandate_hash ?? null, model_id: c.model_id ?? null, prompt_hash: c.prompt_hash ?? null,
        cross_chain_enabled: c.cross_chain_enabled ?? false, cross_chain_recipients: c.cross_chain_recipients ?? [], one_click_key: c.one_click_key ?? null };
    },
    /** The proposal as the wallet stores it, or null if it has none with this id. */
    async proposal(chainProposalId: number): Promise<ChainProposal | null> {
      return view<ChainProposal | null>("get_proposal", { proposal_id: chainProposalId });
    },
    async proposalStatus(chainProposalId: number): Promise<WalletStatus> {
      const p = await view<{ status: Exclude<WalletStatus, null> } | null>("get_proposal", { proposal_id: chainProposalId });
      return p?.status ?? null;
    },
  };
}

/** A proposal as the wallet's get_proposal returns it: the action with its numbers as strings, and the exact args. */
export interface ChainProposal {
  action: ActionJson;
  args_json: string;
  status: Exclude<WalletStatus, null>;
}

export type WalletReader = ReturnType<typeof createWalletReader>;

/** A transaction as the chain recorded it: who signed it, which contract it called, its calls' arguments, and whether it succeeded. */
export interface ChainTx {
  signer_id: string;
  receiver_id: string;
  calls: { method: string; args: Record<string, unknown> | null }[];
  ok: boolean;
}

/** Looks a transaction up by hash and signer, final; null if the chain has no such transaction. */
export function createTxReader(rpcUrl: string) {
  return async function readTx(hash: string, signerId: string): Promise<ChainTx | null> {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "intented-api", method: "tx", params: { tx_hash: hash, sender_account_id: signerId, wait_until: "FINAL" } }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (body.error) {
      if (JSON.stringify(body.error).includes("UNKNOWN_TRANSACTION")) return null;
      throw new Error(`tx lookup failed: ${JSON.stringify(body.error).slice(0, 200)}`);
    }
    const t = body.result.transaction as { signer_id: string; receiver_id: string; actions: ({ FunctionCall?: { method_name: string; args: string } } | string)[] };
    const args = (b64: string) => {
      try {
        return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Record<string, unknown>;
      } catch {
        return null;
      }
    };
    return {
      signer_id: t.signer_id,
      receiver_id: t.receiver_id,
      calls: t.actions.flatMap((a) => (typeof a === "object" && a.FunctionCall ? [{ method: a.FunctionCall.method_name, args: args(a.FunctionCall.args) }] : [])),
      ok: body.result.status && "SuccessValue" in body.result.status,
    };
  };
}
