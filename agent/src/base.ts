// Finds a payment on Base inside a transaction receipt, as returned by the
// eth_getTransactionReceipt RPC method: a successful transaction with an
// ERC-20 Transfer log from the asked token contract to the asked address.

export const BASE_USDC_CONTRACT = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
// keccak256("Transfer(address,address,uint256)")
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface AskedOnBase {
  asset: string; // the token contract, 0x + 40 hex
  payTo: string; // 0x + 40 hex
  amount: string; // the least the transfer must move, in the token's smallest unit
}

interface Log {
  address: string;
  topics: string[];
  data: string;
}

export interface Receipt {
  status: string;
  logs: Log[];
}

export type FoundOnBase = { ok: true; payer: string } | { ok: false; error: string };

const lower = (s: string) => s.toLowerCase();
// An indexed address topic is the address left-padded to 32 bytes.
const topicAddress = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();

export function findBaseTransfer(receipt: Receipt, asked: AskedOnBase): FoundOnBase {
  if (receipt.status !== "0x1") return { ok: false, error: "the transaction failed on Base" };
  for (const log of receipt.logs) {
    const [event, from, to, ...rest] = log.topics;
    if (lower(log.address) !== lower(asked.asset) || !event || lower(event) !== TRANSFER || !from || !to || rest.length) continue;
    if (topicAddress(to) !== lower(asked.payTo)) continue;
    if (BigInt(log.data) < BigInt(asked.amount)) continue;
    return { ok: true, payer: topicAddress(from) };
  }
  return { ok: false, error: "no transfer of at least the asked amount to the asked address" };
}

// Fetches a Base transaction's receipt, or null if it isn't mined yet or doesn't exist.
export type LookupBaseReceipt = (hash: string) => Promise<Receipt | null>;

export function rpcBaseReceipt(rpcUrl: string): LookupBaseReceipt {
  return async (hash) => {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "paywall", method: "eth_getTransactionReceipt", params: [hash] }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { result?: Receipt | null };
    return json.result ?? null;
  };
}
