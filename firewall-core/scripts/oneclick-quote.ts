// 1Click's signed quote, for test fixtures: the payload built from the fields
// 1Click signs (docs/decisions/2026-11-03-accept-signed-1click-quote.md, from
// @defuse-protocol/one-click-sdk-typescript 0.1.26), stable JSON, and ed25519
// over the UTF-8 of base58(sha256(payload)). Written independently of
// api/src/oneclick.ts, so the two can be checked against each other and
// against 1Click's own signature on a live quote.

import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58(bytes: Uint8Array): string {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
  let s = "";
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}

export function unbase58(s: string): Buffer {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("not base58");
    n = n * 58n + BigInt(i);
  }
  const hex = n === 0n ? "" : n.toString(16);
  const body = Buffer.from(hex.length % 2 ? "0" + hex : hex, "hex");
  const zeros = s.length - s.replace(/^1+/, "").length;
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

/** json-stable-stringify: keys sorted at every level, undefined dropped. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : stableJson(x))).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

const REQUEST_FIELDS = ["dry", "swapType", "slippageTolerance", "originAsset", "depositType", "destinationAsset", "amount", "refundTo", "refundType", "recipient", "recipientType", "deadline"];
const REQUEST_IF_SET = ["quoteWaitingTimeMs", "referral", "virtualChainRecipient", "virtualChainRefundRecipient", "customRecipientMsg"];
const QUOTE_FIELDS = ["amountIn", "amountInFormatted", "amountInUsd", "minAmountIn", "amountOut", "amountOutFormatted", "amountOutUsd", "minAmountOut"];
const QUOTE_IF_SET = ["depositAddress", "depositMemo", "deadline", "timeWhenInactive", "timeEstimate", "refundFee", "withdrawFee"];

/** The exact string 1Click signs, from a /v0/quote response. */
export function quotePayload(r: { quoteRequest: Record<string, unknown>; quote: Record<string, unknown>; timestamp: string }): string {
  const pick = (from: Record<string, unknown>, always: string[], ifSet: string[]) => ({
    ...Object.fromEntries(always.map((k) => [k, from[k]])),
    ...Object.fromEntries(ifSet.map((k) => [k, from[k] || undefined])),
  });
  const quote = pick(r.quote, QUOTE_FIELDS, r.quoteRequest.dry ? [] : QUOTE_IF_SET);
  return stableJson({ ...pick(r.quoteRequest, REQUEST_FIELDS, REQUEST_IF_SET), ...quote, timestamp: r.timestamp });
}

export const quoteMessage = (payload: string) => Buffer.from(base58(createHash("sha256").update(payload, "utf8").digest()), "utf8");

const SPKI = Buffer.from("302a300506032b6570032100", "hex");
const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");

export function verifyQuote(payload: string, signature: string, publicKey: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.concat([SPKI, unbase58(publicKey.replace(/^ed25519:/, ""))]), format: "der", type: "spki" });
    return verify(null, quoteMessage(payload), key, unbase58(signature.replace(/^ed25519:/, "")));
  } catch {
    return false;
  }
}

/** A deterministic test signer standing in for 1Click (or for the testnet stand-in). */
export function testQuoteSigner(seedText: string) {
  const seed = createHash("sha256").update(seedText).digest();
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: "der", type: "pkcs8" });
  const pub = createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
  return {
    publicKey: "ed25519:" + base58(pub),
    sign: (payload: string) => "ed25519:" + base58(sign(null, quoteMessage(payload), priv)),
  };
}
