// Free view calls on the wallet contract over NEAR JSON-RPC: its active
// mandate hash, and its own record of a proposal for settling interruptions.

import type { WalletStatus } from "./settle.js";

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
    /** The sha256 of the mandate the wallet accepts verdicts under, or null if none is set. */
    async mandateHash(): Promise<string | null> {
      return (await view<{ mandate_hash: string | null }>("get_config", {})).mandate_hash;
    },
    async proposalStatus(chainProposalId: number): Promise<WalletStatus> {
      const p = await view<{ status: Exclude<WalletStatus, null> } | null>("get_proposal", { proposal_id: chainProposalId });
      return p?.status ?? null;
    },
  };
}

export type WalletReader = ReturnType<typeof createWalletReader>;
