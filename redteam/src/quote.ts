// The signed 1Click quote for a cross-chain case, as the testnet pipeline would get it: the API's quote
// request, answered by the 1Click stand-in in-process. Signed with a key made for this run only; the
// judge never checks the signature (the wallet does), but the model reads the payload.

import { generateKeyPairSync } from "node:crypto";
import { BASE_USDC, createOneClickStandIn, ORIGIN_ASSET } from "../../agent/src/oneclick-standin.js";
import { signedQuote, type QuoteResponse, type SignedQuote } from "../../api/src/oneclick.js";

/** The testnet wallet: the API makes it every quote's refund account. */
const REFUND_TO = "intented-wallet.testnet";

/** "0.4 USDC" in USDC's smallest unit. */
export function usdcUnits(amountOut: string): string {
  const m = /^(\d+)(?:\.(\d{1,6}))? USDC$/.exec(amountOut);
  if (!m) throw new Error(`amount_out ${amountOut} is not whole USDC with at most 6 decimals`);
  return (BigInt(m[1]!) * 10n ** 6n + BigInt((m[2] ?? "").padEnd(6, "0"))).toString();
}

export interface QuoteCase {
  id: string;
  /** The deposit address the wallet pays. */
  payee: string;
  /** What the wallet pays, in wNEAR's smallest unit. */
  amount: string;
  cross_chain: { recipient: string; amount_out: string };
}

/** One quote per case; refuses a case whose wNEAR amount isn't what the stand-in quotes for its amount out. */
export async function signedQuotes(cases: QuoteCase[], deadlineMs: bigint, now = Date.now()): Promise<Map<string, SignedQuote>> {
  const { privateKey } = generateKeyPairSync("ed25519");
  const out = new Map<string, SignedQuote>();
  for (const c of cases) {
    const standIn = createOneClickStandIn({
      depositAddress: c.payee,
      signingKey: privateKey,
      lookupTx: () => Promise.reject(new Error("the red team never deposits")),
      now: () => now,
    });
    // The body the API's quoteRequest sends, with the case's deadline.
    const body = {
      dry: false,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: 100,
      originAsset: ORIGIN_ASSET,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: BASE_USDC,
      amount: usdcUnits(c.cross_chain.amount_out),
      refundTo: REFUND_TO,
      refundType: "ORIGIN_CHAIN",
      recipient: c.cross_chain.recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Number(deadlineMs)).toISOString(),
    };
    const res = await standIn.request("/v0/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${c.id}: the stand-in refused the quote: ${await res.text()}`);
    const r = (await res.json()) as QuoteResponse & { quote: { amountIn: string } };
    if (r.quote.amountIn !== c.amount) throw new Error(`${c.id}: pays ${c.amount} wNEAR units, but ${c.cross_chain.amount_out} quotes at ${r.quote.amountIn}`);
    out.set(c.id, signedQuote(r));
  }
  return out;
}
