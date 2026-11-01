// Writes contract/wallet/tests/canonical_fixture.json: actions and the exact
// canonical string the TypeScript encoder produces for each, so the contract's
// encoder is tested against this one byte for byte.
//
// Usage: pnpm tsx scripts/canonical-fixture.ts

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalBytes, type Action } from "../src/canonical.js";
import { formatAmount } from "../src/tokens.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "contract", "wallet", "tests", "canonical_fixture.json");
const U64_MAX = (1n << 64n) - 1n;
const U128_MAX = ((1n << 128n) - 1n).toString();
const h = (c: string) => c.repeat(64);

const actions: Action[] = [
  { receiver_id: "usdc.fakes.testnet", method: "ft_transfer", args_sha256: h("a"), deposit: "1", nonce: 7n, expiry_ms: 1762041600000n },
  { receiver_id: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af", method: "ft_transfer_call", args_sha256: h("0"), deposit: "0", nonce: 0n, expiry_ms: 0n },
  { receiver_id: "a.b-c_d.near", method: "_private", args_sha256: h("f"), deposit: U128_MAX, nonce: U64_MAX, expiry_ms: U64_MAX },
  { receiver_id: "0x" + "ab".repeat(20), method: "Withdraw2", args_sha256: h("9"), deposit: "1000000000000000000000000", nonce: 9007199254740993n, expiry_ms: 1n },
  { receiver_id: "ab", method: "x", args_sha256: h("e"), deposit: "340282366920938463463374607431768211454", nonce: 1n, expiry_ms: 2n },
];

const cases = actions.map((a) => ({
  action: { ...a, nonce: a.nonce.toString(), expiry_ms: a.expiry_ms.toString() },
  canonical: new TextDecoder().decode(canonicalBytes(a)),
}));
writeFileSync(out, JSON.stringify(cases, null, 2) + "\n");
console.log(`wrote ${cases.length} cases to ${out}`);

// Amounts in whole tokens, as the model is shown them; the contract must format identically.
const amounts: [string, number, string][] = [
  ["1000000000000000000000", 24, "wNEAR"], ["1000000", 6, "USDC"], ["1500000", 6, "USDC"], ["1", 6, "USDC"], ["0", 6, "USDC"],
  ["50000000", 6, "USDC"], ["10000", 6, "USDC.e"], ["123", 0, "X"], ["100", 2, "T"], ["340282366920938463463374607431768211455", 24, "wNEAR"],
  ["340282366920938463463374607431768211455", 38, "MAX"],
];
const amountOut = out.replace("canonical_fixture.json", "amount_fixture.json");
writeFileSync(amountOut, JSON.stringify(amounts.map(([raw, decimals, symbol]) => ({ raw, decimals, symbol, shown: formatAmount(raw, decimals, symbol) })), null, 2) + "\n");
console.log(`wrote ${amounts.length} amounts to ${amountOut}`);
