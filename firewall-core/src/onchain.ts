// The firewall core's on-chain half: proposeOnChain and executeOnChain, signed
// with the agent's function-call key (scoped to propose and execute on the
// wallet), and the outcome reading they share.

import { Account, JsonRpcProvider, KeyPairSigner, actions, type KeyPairString } from "near-api-js";
import type { Action } from "./canonical.js";

export interface Outcome {
  ok: boolean;
  near_tx_hash: string;
  /** The first failure's message, when not ok. */
  error?: string;
  /** The transaction's decoded return value, when ok. */
  value?: string;
}

type Status = { SuccessValue?: string; SuccessReceiptId?: string; Failure?: unknown };

interface TxResponse {
  status: Status;
  transaction: { hash: string };
  receipts_outcome: { outcome: { status: Status } }[];
}

function failureMessage(failure: unknown): string {
  const kind = (failure as { ActionError?: { kind?: { FunctionCallError?: { ExecutionError?: string } } } })?.ActionError?.kind;
  return kind?.FunctionCallError?.ExecutionError ?? JSON.stringify(failure);
}

/**
 * ok only if the transaction and every receipt it spawned succeeded. A wallet
 * execute ends in its own callback, which succeeds even when the proposed call
 * failed, so the top-level status alone is not enough.
 */
export function outcomeOf(response: unknown): Outcome {
  const r = response as TxResponse;
  const near_tx_hash = r.transaction.hash;
  const failed = [r.status, ...r.receipts_outcome.map((x) => x.outcome.status)].find((s) => s && "Failure" in s);
  if (failed) return { ok: false, near_tx_hash, error: failureMessage(failed.Failure) };
  const value = r.status.SuccessValue ? Buffer.from(r.status.SuccessValue, "base64").toString("utf8") : undefined;
  return value === undefined ? { ok: true, near_tx_hash } : { ok: true, near_tx_hash, value };
}

/** The proposal id a successful propose returned. */
export function proposalIdOf(o: Outcome): number {
  if (!o.ok) throw new Error(`propose failed: ${o.error}`);
  const id = o.value === undefined ? NaN : JSON.parse(o.value);
  if (!Number.isSafeInteger(id) || id < 0) throw new Error(`propose returned ${o.value}, not a proposal id`);
  return id;
}


export interface ChainConfig {
  rpcUrl: string;
  /** The wallet contract. */
  walletId: string;
  /** The agent account holding the function-call key. */
  agentId: string;
  /** The agent's function-call key, scoped to propose and execute on the wallet. */
  agentPrivateKey: string;
}

const TGAS = 10n ** 12n;

/** The action as the contract's JSON expects it: u64s as strings. */
function actionJson(a: Action) {
  return { ...a, nonce: a.nonce.toString(), expiry_ms: a.expiry_ms.toString() };
}

export function createChainClient(cfg: ChainConfig) {
  const agent = new Account(cfg.agentId, new JsonRpcProvider({ url: cfg.rpcUrl }), KeyPairSigner.fromSecretKey(cfg.agentPrivateKey as KeyPairString));

  // throwOnFailure: false, so a refused call still returns its outcome and hash.
  async function call(method: string, args: object, tgas: bigint): Promise<Outcome> {
    const response = await agent.signAndSendTransaction({
      receiverId: cfg.walletId,
      actions: [actions.functionCall(method, args, tgas * TGAS, 0n)],
      waitUntil: "FINAL",
      throwOnFailure: false,
    });
    return outcomeOf(response);
  }

  return {
    async proposeOnChain(action: Action, argsJson: string): Promise<{ proposal_id: number; near_tx_hash: string }> {
      const o = await call("propose", { action: actionJson(action), args_json: argsJson }, 30n);
      return { proposal_id: proposalIdOf(o), near_tx_hash: o.near_tx_hash };
    },

    async executeOnChain(proposalId: number, reqBytes: Uint8Array, respBytes: Uint8Array, signature: string): Promise<{ near_tx_hash: string; ok: boolean; error?: string }> {
      const o = await call(
        "execute",
        {
          proposal_id: proposalId,
          req_bytes: Buffer.from(reqBytes).toString("base64"),
          resp_bytes: Buffer.from(respBytes).toString("base64"),
          sig_65: signature,
        },
        300n,
      );
      return o.error === undefined ? { near_tx_hash: o.near_tx_hash, ok: o.ok } : { near_tx_hash: o.near_tx_hash, ok: o.ok, error: o.error };
    },
  };
}
