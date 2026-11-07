// The public types of the `intented` package. test/public-types.ts checks them against the implementation.

/** Where things are, unless a call says otherwise. INTENTED_API_URL, INTENTED_WEB_URL, NEAR_RPC_URL and INTENTED_HOME override them. */
export declare const defaults: { apiUrl: string; webUrl: string; rpcUrl: string; home: string };

/** "2.5" with 6 decimals → "2500000". Exact. Throws on anything but a plain positive number within the decimals. */
export declare function toUnits(amount: string, decimals: number): string;

export interface InitResult {
  /** <name>.intented.testnet */
  walletId: string;
  /** The key file, readable by this user only. */
  path: string;
  publicKey: string;
  /** The Create page, with the name and the public key filled in. */
  link: string;
  /** false when a key was saved already and is returned unchanged. */
  created: boolean;
}

/** Makes the agent's key for <name>.intented.testnet on this machine, unless one is saved, and returns its public key and the Create link. */
export declare function init(options: { name: string; home?: string; webUrl?: string }): InitResult;

export type PayStep =
  | { step: "proposed"; proposal_id: number; near_tx_hash: string }
  | { step: "verdict"; verdict: "ALLOW" | "DENY"; reason: string; signer: string }
  | { step: "executed"; near_tx_hash: string; ok: boolean; error?: string }
  | { step: "reported"; ok: boolean; error?: string };

export type PayResult =
  | { outcome: "paid"; proposal_id: number; id: string; execute_tx: string; reason: string }
  | { outcome: "denied"; proposal_id: number; id: string; execute_tx: string; reason: string }
  | { outcome: "failed"; proposal_id: number; id: string; execute_tx: string; reason: string; error: string }
  | { outcome: "no verdict"; proposal_id: number; error: string };

export interface PayOptions {
  /** The agent's wallet, e.g. my-agent.intented.testnet. Its key must be saved by `init`. */
  wallet: string;
  /** The NEAR account to pay. */
  to: string;
  /** How much, in whole tokens, e.g. "0.001". */
  amount: string;
  /** The token contract; wNEAR (wrap.testnet) by default. Only tokens the firewall core knows. */
  token?: string;
  /** What the agent read that led to this payment, verbatim, e.g. the HTTP 402 reply. The judge reads it as data. */
  context: string;
  apiUrl?: string;
  rpcUrl?: string;
  home?: string;
  /** Called as each step happens. */
  onStep?: (s: PayStep) => void;
}

/**
 * Proposes the payment on the wallet, gets the signed verdict on exactly that proposal, and hands it to the wallet.
 * The wallet pays only on a valid ALLOW within its caps; a DENY is refused on chain and nothing moves.
 */
export declare function pay(options: PayOptions): Promise<PayResult>;
