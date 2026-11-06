// Reads from the wallet contract over public RPC, straight from the browser,
// so what the page shows as "on the wallet" doesn't depend on our API. Also imported on the server, for walletFromParam.

// One build per network: NEXT_PUBLIC_NEAR_NETWORK picks it, testnet unless set. The mainnet build is a second site that
// shows only the mainnet wallet (docs/decisions/2026-11-06-minimal-mainnet-with-a-network-switch.md). Fixed at build time,
// so a page can't mix networks.
export const NETWORK: "testnet" | "mainnet" = process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const IS_MAINNET = NETWORK === "mainnet";
/** "NEAR testnet" or "NEAR mainnet", for copy. */
export const NETWORK_NAME = `NEAR ${NETWORK}`;

/** The demo wallet. On mainnet it has no default: the build stops unless NEXT_PUBLIC_WALLET_ID names it. */
export const WALLET_ID =
  process.env.NEXT_PUBLIC_WALLET_ID ||
  (IS_MAINNET ? (() => { throw new Error("NEXT_PUBLIC_WALLET_ID must be set for a mainnet build"); })() : "intented-wallet.testnet");
const RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC_URL || (IS_MAINNET ? "https://free.rpc.fastnear.com" : "https://test.rpc.fastnear.com");

/** Each build's address, for the header's Testnet | Mainnet switch. Unset, the switch leaves that network out. */
export const SITE_URLS: Record<typeof NETWORK, string | null> = {
  testnet: process.env.NEXT_PUBLIC_TESTNET_URL?.replace(/\/+$/, "") || null,
  mainnet: process.env.NEXT_PUBLIC_MAINNET_URL?.replace(/\/+$/, "") || null,
};

const NEARBLOCKS = IS_MAINNET ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
export const nearblocksAccount = (id: string) => `${NEARBLOCKS}/address/${id}`;
export const nearblocksTx = (hash: string) => `${NEARBLOCKS}/txns/${hash}`;

/** get_config, as the contract returns it. */
export type WalletConfig = {
  owner_id: string;
  agent_id: string;
  model_id: string;
  frozen: boolean;
  mandate_hash: string | null;
  prompt_hash: string | null;
  signers: string[];
  receivers: string[];
  near_caps: { per_tx: string; daily: string };
};

export type WalletToken = { symbol: string; decimals: number; caps: { per_tx: string; daily: string } };

/** A view call on any contract; `view` below is the same on our wallet. */
export async function viewOn<T>(accountId: string, method: string, args: object): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: method,
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: accountId,
        method_name: method,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  const body = await res.json();
  if (body.error || body.result?.error) throw new Error(`${method}: ${JSON.stringify(body.error ?? body.result.error)}`);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(body.result.result)));
}

export const getConfig = (walletId: string = WALLET_ID) => viewOn<WalletConfig>(walletId, "get_config", {});
export const getToken = (tokenId: string, walletId: string = WALLET_ID) => viewOn<WalletToken | null>(walletId, "get_token", { token_id: tokenId });

/** The wallet factory (contract/factory): create(...) makes <name>.intented.testnet. Testnet only; mainnet has none. */
export const FACTORY_ID: string | null = IS_MAINNET ? null : "intented.testnet";

/** One account label: lowercase letters and digits, with single - or _ between them. */
export const LABEL = /^(?:[a-z\d]+[-_])*[a-z\d]+$/;

/**
 * The wallet a page shows, from its ?wallet= parameter: our own wallet, or one the factory made.
 * Only the factory can create accounts under it, so the name alone says it's an Intented wallet. null for anything else.
 */
export function walletFromParam(param: string | null): string | null {
  if (!param || param === WALLET_ID) return WALLET_ID;
  if (!FACTORY_ID) return null;
  const suffix = `.${FACTORY_ID}`;
  if (param.length > 64 || !param.endsWith(suffix)) return null;
  return LABEL.test(param.slice(0, -suffix.length)) ? param : null;
}

/** A query of another kind than a view call, e.g. view_account; the raw result. */
async function query(requestType: string, accountId: string) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestType,
      method: "query",
      params: { request_type: requestType, finality: "final", account_id: accountId },
    }),
  });
  return res.json();
}

/** NEAR's storage price: yoctoNEAR per byte. */
const STORAGE_BYTE_COST = BigInt("10000000000000000000");

export type AccountView = { code_hash: string; amount: string; storage_usage: number };

/** An account's code hash, balance and storage from view_account, or null if it doesn't exist; any other RPC error is thrown. */
export async function viewAccount(accountId: string): Promise<AccountView | null> {
  const body = await query("view_account", accountId);
  if (body.error?.cause?.name === "UNKNOWN_ACCOUNT") return null;
  if (body.error) throw new Error(`view_account: ${JSON.stringify(body.error)}`);
  return { code_hash: body.result.code_hash, amount: body.result.amount, storage_usage: body.result.storage_usage };
}

/** The NEAR the account holds above what its storage locks: what the wallet's withdraw(None, …) can send. */
export function freeNear(a: AccountView): string {
  const free = BigInt(a.amount) - STORAGE_BYTE_COST * BigInt(a.storage_usage);
  return free > BigInt(0) ? free.toString() : "0";
}

/** A function-call key on an account: who it may call, which methods, and the gas allowance left (null: unlimited). */
export type FunctionCallKey = { public_key: string; receiver_id: string; method_names: string[]; allowance: string | null };

/** The account's function-call keys. Full-access keys are counted, not listed: a factory wallet has none. */
export async function viewKeys(accountId: string): Promise<{ functionCall: FunctionCallKey[]; fullAccess: number }> {
  const body = await query("view_access_key_list", accountId);
  if (body.error) throw new Error(`view_access_key_list: ${JSON.stringify(body.error)}`);
  const functionCall: FunctionCallKey[] = [];
  let fullAccess = 0;
  for (const k of body.result.keys as { public_key: string; access_key: { permission: unknown } }[]) {
    const perm = k.access_key.permission as "FullAccess" | { FunctionCall: { receiver_id: string; method_names: string[]; allowance: string | null } };
    if (perm === "FullAccess") fullAccess++;
    else functionCall.push({ public_key: k.public_key, ...perm.FunctionCall });
  }
  return { functionCall, fullAccess };
}

/** A NEP-141 token balance, in base units. */
export const ftBalance = (token: string, accountId: string) => viewOn<string>(token, "ft_balance_of", { account_id: accountId });

export type Token = { contract: string; symbol: string; decimals: number };

/** Tokens a wallet can pay in, per network. Symbol and decimals must equal firewall-core's KNOWN_TOKENS, or the wallet refuses every transfer of it. */
const TOKENS_BY_NETWORK: Record<typeof NETWORK, readonly Token[]> = {
  testnet: [
    { contract: "wrap.testnet", symbol: "wNEAR", decimals: 24 },
    { contract: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af", symbol: "USDC", decimals: 6 },
    { contract: "usdc.fakes.testnet", symbol: "USDC.e", decimals: 6 },
  ],
  mainnet: [
    { contract: "wrap.near", symbol: "wNEAR", decimals: 24 },
    { contract: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", symbol: "USDC", decimals: 6 },
    { contract: "usdt.tether-token.near", symbol: "USDt", decimals: 6 },
  ],
};
export const TOKENS = TOKENS_BY_NETWORK[NETWORK];

/** A whole-unit amount as a base-unit integer string, e.g. ("0.01", 24) → "10000000000000000000000"; null if it isn't a plain decimal or has too many places. */
export function parseUnits(value: string, decimals: number): string | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m || (m[2]?.length ?? 0) > decimals) return null;
  const raw = (m[1] + (m[2] ?? "").padEnd(decimals, "0")).replace(/^0+(?=\d)/, "");
  return raw;
}

/**
 * What an amount field keeps of what was typed or pasted: digits and one dot, at most `decimals` after it.
 * A comma becomes the dot, for keyboards that type one.
 */
export function decimalInput(value: string, decimals: number): string {
  const s = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  return dot < 0 ? s : s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
}

/** Lowercase hex sha256 of the text's UTF-8 bytes, exactly as the wallet's mandate_hash is computed. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A base-unit integer string in whole units, e.g. ("10000000000000000000000", 24) → "0.01". */
export function formatUnits(raw: string, decimals: number): string {
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
