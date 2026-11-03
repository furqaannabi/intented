// The x402 v2 shapes this demo uses, on NEAR testnet. Headers carry
// base64-encoded JSON: PAYMENT-REQUIRED on the 402, PAYMENT-SIGNATURE on the
// paid retry, PAYMENT-RESPONSE on the 200.

export interface Requirement {
  scheme: "exact";
  network: string; // CAIP-2, "near:testnet"
  asset: string; // the token contract
  amount: string; // the token's smallest unit, decimal
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { symbol: string; decimals: number };
}

export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: { url: string; description: string; mimeType: string };
  accepts: Requirement[];
}

export interface PaymentPayload {
  x402Version: 2;
  accepted: Requirement;
  // NEAR routes: the payment's tx hash and the account that signed it. Base routes: the Base tx hash, or on
  // testnet, where nothing reaches Base, the NEAR deposit's tx hash and the 1Click deposit address.
  payload: { transaction: string; signer?: string; deposit_address?: string };
}

export interface SettlementResponse {
  success: boolean;
  transaction: string;
  network: string;
  payer: string;
}

export const encode = (v: unknown): string => Buffer.from(JSON.stringify(v), "utf8").toString("base64");

export function decode<T>(header: string): T | null {
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}
