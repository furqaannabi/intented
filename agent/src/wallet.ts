// The agent's own transactions on a factory wallet. The agent's key sits on the
// wallet account itself, scoped to propose and execute, so the wallet is the
// signer. It signs through the firewall core's chain client, the same code the
// API uses for the demo wallet, so the action and its encoding can't drift.

import { createHash } from "node:crypto";
import { createChainClient, type Action } from "@intented/firewall-core";
import type { AgentKey } from "./init.js";

/** How long a proposal stays payable. The verdict needs at least a minute of it left, the API at most an hour. */
export const EXPIRY_MS = 15 * 60_000;

export interface Payment {
  /** The fungible token contract, e.g. wrap.testnet. */
  token: string;
  /** Who gets paid. */
  to: string;
  /** In the token's smallest unit, as a decimal string. */
  amount: string;
  memo?: string;
  /** When the proposal stops being payable, in ms; default 15 minutes from now. A payment through 1Click must expire before its quote. */
  expiresAt?: number;
}

/** The ft_transfer the wallet will make, with args_sha256 over the exact args string it sends. */
export function paymentAction(p: Payment, now: number): { action: Action; argsJson: string } {
  const argsJson = JSON.stringify(p.memo === undefined ? { receiver_id: p.to, amount: p.amount } : { receiver_id: p.to, amount: p.amount, memo: p.memo });
  return {
    argsJson,
    action: {
      receiver_id: p.token,
      method: "ft_transfer",
      args_sha256: createHash("sha256").update(argsJson, "utf8").digest("hex"),
      deposit: "1", // ft_transfer needs exactly one yoctoNEAR
      nonce: BigInt(now),
      expiry_ms: BigInt(p.expiresAt ?? now + EXPIRY_MS),
    },
  };
}

/** A signed verdict as POST /api/verdict returns it: the bytes base64, ready for execute. */
export interface SignedVerdict {
  req_bytes: string;
  resp_bytes: string;
  signature: string;
}

/**
 * NEAR's errors for an agent that can't pay its gas, said plainly with what to do; null for anything else.
 * `signerId` is the account the agent's key is on, which pays the gas: the wallet itself, or the demo wallets'
 * own agent account. The wallet pays its own storage either way.
 * Matched by name and by the outcome's text, since a transaction can be refused before it runs or fail while it runs.
 */
export function outOfGas(e: unknown, walletId: string, signerId = walletId): string | null {
  if (!(e instanceof Error)) return null;
  const said = `${e.name} ${e.message}`;
  if (/LackBalanceForState/.test(said)) return `${walletId} doesn't have enough NEAR for its storage. Ask its owner to send NEAR to ${walletId}.`;
  if (/NotEnoughBalance/.test(said)) {
    return signerId === walletId
      ? `${walletId} doesn't have enough NEAR for gas. Ask its owner to send NEAR to ${walletId}.`
      : `${signerId}, which pays this agent's gas, doesn't have enough NEAR for it. Send NEAR to ${signerId}.`;
  }
  if (/NotEnoughAllowance/.test(said)) return `This agent's key has used up its gas limit on ${signerId}. Ask its owner to add the key again with a new limit.`;
  if (/AccessKeyDoesNotExist/.test(said)) return `This agent's key isn't on ${signerId}. Ask its owner to add it, or run intented init for a new one.`;
  return null;
}

/** propose and execute on the agent's own wallet, signed with its saved key. The API holds no key for this wallet. */
/** `agentId`: the account the key belongs to, when it isn't the wallet itself (the demo wallet's `intented-agent.testnet`). */
export function walletAgent({ key, rpcUrl, agentId = key.walletId }: { key: Pick<AgentKey, "walletId" | "privateKey">; rpcUrl: string; agentId?: string }) {
  const chain = createChainClient({ rpcUrl, walletId: key.walletId, agentId, agentPrivateKey: key.privateKey });
  // Out of gas, out of limit, or no key: one plain sentence instead of NEAR's error, with the original kept as the cause.
  const plain = (e: unknown): never => {
    const said = outOfGas(e, key.walletId, agentId);
    throw said ? new Error(said, { cause: e }) : e;
  };

  return {
    /** Records the payment on the wallet as pending; nothing moves until execute carries an ALLOW. */
    async propose(p: Payment, now = Date.now()) {
      const { action, argsJson } = paymentAction(p, now);
      const { proposal_id, near_tx_hash } = await chain.proposeOnChain(action, argsJson).catch(plain);
      return { proposal_id, near_tx_hash, action, argsJson };
    },

    /** Hands the wallet the verdict. It pays only on a valid ALLOW within its caps; a DENY is refused on chain, as the record. */
    async execute(proposalId: number, v: SignedVerdict) {
      const o = await chain.executeOnChain(proposalId, Buffer.from(v.req_bytes, "base64"), Buffer.from(v.resp_bytes, "base64"), v.signature).catch(plain);
      const gas = o.error === undefined ? null : outOfGas(new Error(o.error), key.walletId, agentId);
      return gas ? { ...o, error: gas } : o;
    },
  };
}
