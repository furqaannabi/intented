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

async function view<T>(method: string, args: object): Promise<T> {
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
        account_id: WALLET_ID,
        method_name: method,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  const body = await res.json();
  if (body.error || body.result?.error) throw new Error(`${method}: ${JSON.stringify(body.error ?? body.result.error)}`);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(body.result.result)));
}

export const getConfig = () => view<WalletConfig>("get_config", {});
export const getToken = (tokenId: string) => view<WalletToken | null>("get_token", { token_id: tokenId });

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
