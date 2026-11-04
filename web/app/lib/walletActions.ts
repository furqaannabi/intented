// Transactions the owner signs in their own NEAR wallet, shared by the Create page and the wallet page.

import type { TESTNET_TOKENS } from "./near";

export const CALL_GAS = "30000000000000"; // 30 Tgas
export const WITHDRAW_GAS = "60000000000000"; // withdraw of a token makes its own ft_transfer call
const ONE_YOCTO = "1";
const STORAGE_DEPOSIT = "1250000000000000000000"; // 0.00125 NEAR, a token's registration

/** An ed25519 public key in NEAR's text form. */
export const ED25519_KEY = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export type FunctionCall = { type: "FunctionCall"; params: { methodName: string; args: object; gas: string; deposit: string } };

export const call = (methodName: string, args: object, deposit = "0", gas = CALL_GAS): FunctionCall => ({
  type: "FunctionCall",
  params: { methodName, args, gas, deposit },
});

type Token = (typeof TESTNET_TOKENS)[number];

/**
 * One transaction to the token's contract that puts `raw` base units in the wallet. wNEAR is wrapped from the owner's
 * NEAR first. registration_only refunds what isn't needed, so registering an account that already is costs nothing.
 */
export function fundActions(token: Token, owner: string, walletId: string, raw: string): FunctionCall[] {
  return [
    call("storage_deposit", { account_id: walletId, registration_only: true }, STORAGE_DEPOSIT),
    ...(token.symbol === "wNEAR"
      ? [call("storage_deposit", { account_id: owner, registration_only: true }, STORAGE_DEPOSIT), call("near_deposit", {}, raw)]
      : []),
    call("ft_transfer", { receiver_id: walletId, amount: raw }, ONE_YOCTO),
  ];
}
