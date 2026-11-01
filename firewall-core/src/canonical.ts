export interface Action {
  receiver_id: string;
  method: string;
  args_sha256: string;
  /** yoctoNEAR, decimal string */
  deposit: string;
  nonce: bigint;
  expiry_ms: bigint;
}

const U64_MAX = (1n << 64n) - 1n;
const U128_MAX = (1n << 128n) - 1n;

/** Canonical decimal only: no sign, no leading zero, no whitespace, so each amount has one encoding. */
const DECIMAL = /^(0|[1-9][0-9]*)$/;

/** NEAR account id rules (near-account-id): lowercase alphanumerics, single `.` `-` `_` separators, 2–64 chars. */
const ACCOUNT_ID = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const METHOD = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function checkU64(field: string, value: bigint): void {
  if (value < 0n || value > U64_MAX) throw new RangeError(`${field} is outside u64`);
}

/**
 * The interface spec's canonical bytes; the contract encodes the same way.
 * Throws on any field the contract could not encode identically.
 */
export function canonicalBytes(action: Action): Uint8Array {
  const { receiver_id, method, args_sha256, deposit, nonce, expiry_ms } = action;
  if (receiver_id.length < 2 || receiver_id.length > 64 || !ACCOUNT_ID.test(receiver_id)) {
    throw new RangeError("receiver_id is not a valid NEAR account id");
  }
  if (!METHOD.test(method)) throw new RangeError("method must be an identifier");
  if (!SHA256_HEX.test(args_sha256)) throw new RangeError("args_sha256 must be 64 lowercase hex chars");
  if (!DECIMAL.test(deposit) || BigInt(deposit) > U128_MAX) {
    throw new RangeError("deposit must be a canonical decimal u128 (yoctoNEAR)");
  }
  checkU64("nonce", nonce);
  checkU64("expiry_ms", expiry_ms);
  const text = ["INTENTED_V1", receiver_id, method, args_sha256, deposit, nonce, expiry_ms].join("|");
  return new TextEncoder().encode(text);
}
