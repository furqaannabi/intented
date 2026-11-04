// Reads from the wallet contract over public RPC, straight from the browser,
// so what the page shows as "on the wallet" doesn't depend on our API.

export const NETWORK = "testnet" as const;
export const WALLET_ID = "intented-wallet.testnet";
const RPC_URL = "https://test.rpc.fastnear.com";

export const nearblocksAccount = (id: string) => `https://testnet.nearblocks.io/address/${id}`;
export const nearblocksTx = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;

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

/** The testnet wallet factory (contract/factory): create(...) makes <name>.intented.testnet. */
export const FACTORY_ID = "intented.testnet";

/** One account label: lowercase letters and digits, with single - or _ between them. */
export const LABEL = /^(?:[a-z\d]+[-_])*[a-z\d]+$/;

/**
 * The wallet a page shows, from its ?wallet= parameter: our own wallet, or one the factory made.
 * Only the factory can create accounts under it, so the name alone says it's an Intented wallet. null for anything else.
 */
export function walletFromParam(param: string | null): string | null {
  if (!param || param === WALLET_ID) return WALLET_ID;
  const suffix = `.${FACTORY_ID}`;
  if (param.length > 64 || !param.endsWith(suffix)) return null;
  return LABEL.test(param.slice(0, -suffix.length)) ? param : null;
}

/** An account's code hash and balance from view_account, or null if it doesn't exist; any other RPC error is thrown. */
export async function viewAccount(accountId: string): Promise<{ code_hash: string; amount: string } | null> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "view_account",
      method: "query",
      params: { request_type: "view_account", finality: "final", account_id: accountId },
    }),
  });
  const body = await res.json();
  if (body.error?.cause?.name === "UNKNOWN_ACCOUNT") return null;
  if (body.error) throw new Error(`view_account: ${JSON.stringify(body.error)}`);
  return { code_hash: body.result.code_hash, amount: body.result.amount };
}

/** Tokens a wallet can pay in on testnet. Symbol and decimals must equal firewall-core's KNOWN_TOKENS, or the wallet refuses every transfer of it. */
export const TESTNET_TOKENS = [
  { contract: "wrap.testnet", symbol: "wNEAR", decimals: 24 },
  { contract: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af", symbol: "USDC", decimals: 6 },
  { contract: "usdc.fakes.testnet", symbol: "USDC.e", decimals: 6 },
] as const;

/** A whole-unit amount as a base-unit integer string, e.g. ("0.01", 24) → "10000000000000000000000"; null if it isn't a plain decimal or has too many places. */
export function parseUnits(value: string, decimals: number): string | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m || (m[2]?.length ?? 0) > decimals) return null;
  const raw = (m[1] + (m[2] ?? "").padEnd(decimals, "0")).replace(/^0+(?=\d)/, "");
  return raw;
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
