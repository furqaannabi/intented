// Free view calls on the wallet contract over NEAR JSON-RPC: what it accepts
// verdicts under, and its own record of a proposal for settling interruptions.

import type { WalletStatus } from "./settle.js";
import type { ActionJson } from "./store.js";

/** What the wallet accepts verdicts under: each is null until the owner sets it. */
export interface WalletConfig {
  frozen: boolean;
  mandate_hash: string | null;
  model_id: string | null;
  prompt_hash: string | null;
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
      return { frozen: c.frozen ?? false, mandate_hash: c.mandate_hash ?? null, model_id: c.model_id ?? null, prompt_hash: c.prompt_hash ?? null };
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
