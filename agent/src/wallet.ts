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

/** propose and execute on the agent's own wallet, signed with its saved key. The API holds no key for this wallet. */
export function walletAgent({ key, rpcUrl }: { key: AgentKey; rpcUrl: string }) {
  const chain = createChainClient({ rpcUrl, walletId: key.walletId, agentId: key.walletId, agentPrivateKey: key.privateKey });

  return {
    /** Records the payment on the wallet as pending; nothing moves until execute carries an ALLOW. */
    async propose(p: Payment, now = Date.now()) {
      const { action, argsJson } = paymentAction(p, now);
      const { proposal_id, near_tx_hash } = await chain.proposeOnChain(action, argsJson);
      return { proposal_id, near_tx_hash, action, argsJson };
    },

    /** Hands the wallet the verdict. It pays only on a valid ALLOW within its caps; a DENY is refused on chain, as the record. */
    execute(proposalId: number, v: SignedVerdict) {
      return chain.executeOnChain(proposalId, Buffer.from(v.req_bytes, "base64"), Buffer.from(v.resp_bytes, "base64"), v.signature);
    },
  };
}
