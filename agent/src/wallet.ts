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
      expiry_ms: BigInt(now + EXPIRY_MS),
    },
  };
}

/** A signed verdict as POST /api/verdict returns it (proposed, not built yet): the bytes base64, ready for execute. */
export interface SignedVerdict {
  req_bytes: string;
  resp_bytes: string;
  signature: string;
}

/**
 * NEAR's errors for a wallet that can't pay its agent's gas, said plainly with what to do; null for anything else.
 * Matched by name and by the outcome's text, since a transaction can be refused before it runs or fail while it runs.
 */
export function outOfGas(e: unknown, walletId: string): string | null {
  if (!(e instanceof Error)) return null;
  const said = `${e.name} ${e.message}`;
  if (/NotEnoughBalance|LackBalanceForState/.test(said)) return `${walletId} has no NEAR left for gas. Ask its owner to send NEAR to ${walletId}.`;
  if (/NotEnoughAllowance/.test(said)) return `This agent's key has used up its gas limit on ${walletId}. Ask its owner to add the key again with a new limit.`;
  if (/AccessKeyDoesNotExist/.test(said)) return `This agent's key isn't on ${walletId}. Ask its owner to add it, or run pnpm intented init for a new one.`;
  return null;
}

/** propose and execute on the agent's own wallet, signed with its saved key. The API holds no key for this wallet. */
export function walletAgent({ key, rpcUrl }: { key: AgentKey; rpcUrl: string }) {
  const chain = createChainClient({ rpcUrl, walletId: key.walletId, agentId: key.walletId, agentPrivateKey: key.privateKey });
  // Out of gas, out of limit, or no key: one plain sentence instead of NEAR's error, with the original kept as the cause.
  const plain = (e: unknown): never => {
    const said = outOfGas(e, key.walletId);
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
      const gas = o.error === undefined ? null : outOfGas(new Error(o.error), key.walletId);
      return gas ? { ...o, error: gas } : o;
    },
  };
}
