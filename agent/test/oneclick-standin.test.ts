import { describe, expect, it } from "vitest";
import { base58, signedQuote, verifySignedQuote } from "../../api/src/oneclick.js";
import { BASE_USDC, createOneClickStandIn, ORIGIN_ASSET, standInKey } from "../src/oneclick-standin.js";

const DEPOSIT = "intented-1click.testnet";
const RECIPIENT = "0x2ef2fed3f9b3d5385499008051031320b1fb49ef";
// A test seed only; the real one is created by pnpm oneclick-key and lives in .env.
const KEY = standInKey(`ed25519:${base58(Buffer.alloc(32, 7))}`);

// The smallest EXPERIMENTAL_tx_status result findPayment reads: one ft_transfer receipt.
const transferTx = (receiverId: string, amount: string, outcome: Record<string, unknown> = { SuccessValue: "" }) => ({
  receipts: [
    {
      receipt_id: "r1",
      predecessor_id: "intented-wallet.testnet",
      receiver_id: "wrap.testnet",
      receipt: {
        Action: {
          actions: [
            { FunctionCall: { method_name: "ft_transfer", args: Buffer.from(JSON.stringify({ receiver_id: receiverId, amount })).toString("base64") } },
          ],
        },
      },
    },
  ],
  receipts_outcome: [{ id: "r1", outcome: { status: outcome } }],
});

function setup(txs: Record<string, unknown> = {}) {
  let clock = Date.parse("2026-11-03T12:00:00Z");
  const app = createOneClickStandIn({
    depositAddress: DEPOSIT,
    signingKey: KEY.privateKey,
    lookupTx: async (hash) => txs[hash] ?? null,
    usdcPerWnear: 50n,
    deliverAfterMs: 5000,
    now: () => clock,
  });
  const post = (path: string, body: unknown) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const quote = (extra: Record<string, unknown> = {}) =>
    post("/v0/quote", {
      dry: false,
      swapType: "EXACT_OUTPUT",
      originAsset: ORIGIN_ASSET,
      destinationAsset: BASE_USDC,
      amount: "400000", // 0.40 USDC
      recipient: RECIPIENT,
      refundTo: "intented-wallet.testnet",
      deadline: new Date(clock + 30 * 60_000).toISOString(),
      ...extra,
    });
  const status = async () => (await app.request(`/v0/status?depositAddress=${DEPOSIT}`)).json() as Promise<{ status: string; swapDetails: unknown }>;
  const submit = (txHash: string) => post("/v0/deposit/submit", { txHash, depositAddress: DEPOSIT, nearSenderAccount: "intented-agent.testnet" });
  return { post, quote, status, submit, tick: (ms: number) => (clock += ms) };
}

describe("1Click stand-in", () => {
  it("quotes the exact output at the demo rate, with a 1% buffer on the input", async () => {
    const { quote } = setup();
    const { quote: q } = await (await quote()).json();
    // 0.40 USDC at 50 USDC per wNEAR is 0.008 wNEAR, plus 1%.
    expect(q).toMatchObject({
      depositAddress: DEPOSIT,
      amountOut: "400000",
      minAmountOut: "400000",
      minAmountIn: "8000000000000000000000",
      amountIn: "8080000000000000000000",
      amountInFormatted: "0.00808",
    });
  });

  it("signs each quote as 1Click does, so the API's verifier accepts it with the stand-in's key", async () => {
    const { quote } = setup();
    const r = await (await quote()).json();
    expect(verifySignedQuote(signedQuote(r), KEY.publicKey)).toBe(true);
    expect(JSON.parse(signedQuote(r).payload)).toMatchObject({ depositAddress: DEPOSIT, recipient: RECIPIENT, refundTo: "intented-wallet.testnet", dry: false });
  });

  it("signs nothing a changed deposit address or another key would pass", async () => {
    const { quote } = setup();
    const q = signedQuote(await (await quote()).json());
    expect(verifySignedQuote({ ...q, payload: q.payload.replace(DEPOSIT, "attacker.testnet") }, KEY.publicKey)).toBe(false);
    expect(verifySignedQuote(q, standInKey(`ed25519:${base58(Buffer.alloc(32, 8))}`).publicKey)).toBe(false);
  });

  it("gives no deposit address for a dry quote", async () => {
    const { quote } = setup();
    const { quote: q } = await (await quote({ dry: true })).json();
    expect(q.depositAddress).toBeUndefined();
  });

  it("refuses anything but exact-output wNEAR for Base USDC", async () => {
    const { quote } = setup();
    expect((await quote({ swapType: "EXACT_INPUT" })).status).toBe(400);
    expect((await quote({ originAsset: "nep141:usdc.fakes.testnet" })).status).toBe(400);
    expect((await quote({ recipient: "intented-vendor.testnet" })).status).toBe(400);
  });

  it("reports delivery only after the real deposit of exactly amountIn, and never a Base transaction", async () => {
    const { quote, status, submit, tick } = setup({ paid: transferTx(DEPOSIT, "8080000000000000000000") });
    await quote();
    expect((await status()).status).toBe("PENDING_DEPOSIT");
    expect((await submit("paid")).status).toBe(200);
    expect((await status()).status).toBe("PROCESSING");
    tick(5000);
    expect(await status()).toMatchObject({
      status: "SUCCESS",
      quoteResponse: { quoteRequest: { recipient: RECIPIENT } },
      swapDetails: { originChainTxHashes: [{ hash: "paid" }], destinationChainTxHashes: [] },
    });
  });

  it("refuses a deposit of the wrong amount, to the wrong account, or that failed", async () => {
    const { quote, status, submit } = setup({
      short: transferTx(DEPOSIT, "8000000000000000000000"),
      elsewhere: transferTx("intented-attacker.testnet", "8080000000000000000000"),
      failed: transferTx(DEPOSIT, "8080000000000000000000", { Failure: {} }),
    });
    await quote();
    for (const hash of ["short", "elsewhere", "failed", "missing"]) expect((await submit(hash)).status).toBe(400);
    expect((await status()).status).toBe("PENDING_DEPOSIT");
  });

  it("fails a quote nobody paid before its deadline", async () => {
    const { quote, status, tick } = setup();
    await quote();
    tick(31 * 60_000);
    expect((await status()).status).toBe("FAILED");
  });
});
