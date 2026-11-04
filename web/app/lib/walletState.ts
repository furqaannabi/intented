// Everything a page shows about one wallet, read from the chain in the browser, plus its rules' text from the API,
// shown only if it hashes to the wallet's mandate_hash.

import { ftBalance, getConfig, getToken, sha256Hex, viewAccount, viewKeys, type AccountView, type FunctionCallKey, type WalletConfig, type WalletToken } from "./near";

export type RulesText =
  | { state: "none" } // the wallet has no mandate set
  | { state: "live"; text: string }
  | { state: "unavailable" } // the API couldn't give a text for this hash
  | { state: "mismatch" }; // the API gave a text whose hash isn't the wallet's

export type WalletState = {
  config: WalletConfig;
  account: AccountView;
  /** The tokens the wallet may pay in, with its balance of each (null if the token contract didn't answer). */
  tokens: { id: string; token: WalletToken; balance: string | null }[];
  /** Keys that may call propose and execute on the wallet itself: the agent's. */
  agentKeys: FunctionCallKey[];
  fullAccessKeys: number;
  rules: RulesText;
};

export async function readRules(mandateHash: string | null): Promise<RulesText> {
  if (!mandateHash) return { state: "none" };
  const res = await fetch(`/api/mandates/${mandateHash}`).catch(() => null);
  const body = res?.ok ? await res.json().catch(() => null) : null;
  if (typeof body?.text !== "string") return { state: "unavailable" };
  return (await sha256Hex(body.text)) === mandateHash ? { state: "live", text: body.text } : { state: "mismatch" };
}

/** null if no account has this id. */
export async function loadWallet(walletId: string): Promise<WalletState | null> {
  const account = await viewAccount(walletId);
  if (!account) return null;
  const [config, keys] = await Promise.all([getConfig(walletId), viewKeys(walletId)]);
  const [tokens, rules] = await Promise.all([
    Promise.all(
      config.receivers.map(async (id) => {
        const token = await getToken(id, walletId);
        if (!token) return null;
        const balance = await ftBalance(id, walletId).catch(() => null);
        return { id, token, balance };
      }),
    ),
    readRules(config.mandate_hash),
  ]);
  return {
    config,
    account,
    tokens: tokens.filter((t) => t !== null),
    agentKeys: keys.functionCall.filter((k) => k.receiver_id === walletId),
    fullAccessKeys: keys.fullAccess,
    rules,
  };
}
