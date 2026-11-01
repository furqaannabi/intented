// KT4: a real 1Click payment, NEAR USDC to Base USDC, arriving at William's
// Base address. This script never moves funds: Furqaan sends the ft_transfer
// to the deposit address, on mainnet, after both owners say yes.
//
// Usage: pnpm kt4 preview [--amount N]       prices and fees; no deposit address
//        pnpm kt4 quote [--amount N]         a live deposit address, valid 30 minutes
//        pnpm kt4 submit <deposit> <tx_hash> tell 1Click the deposit was sent
//        pnpm kt4 status <deposit>           poll until delivered, refunded or failed
// --amount is in USDC's smallest unit (6 decimals); the default 2000000 is 2 USDC.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createOneClick, type CrossChainPayment, type DepositStatus } from "../src/oneclick.js";

const NEAR_USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const DONE: DepositStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { amount: { type: "string", default: "2000000" } },
});
const [command = "preview", ...rest] = positionals;
const oneclick = createOneClick({ jwt: process.env.ONECLICK_JWT || undefined });

function payment(): CrossChainPayment {
  const recipient = process.env.BASE_RECIPIENT_ADDRESS ?? "";
  const refund_to = process.env.ONECLICK_REFUND_TO ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error("BASE_RECIPIENT_ADDRESS must be a 0x Base address");
  if (!/^([a-z0-9]+[-_.])*[a-z0-9]+$/.test(refund_to)) throw new Error("ONECLICK_REFUND_TO must be a NEAR mainnet account");
  if (!/^[1-9][0-9]*$/.test(opts.amount)) throw new Error("--amount must be a positive integer in smallest units");
  return { amount: opts.amount, origin_asset: NEAR_USDC, dest_asset: BASE_USDC, recipient, refund_to };
}

if (command === "preview" || command === "quote") {
  const p = payment();
  const live = command === "quote";
  const result = live ? await oneclick.payCrossChain(p) : { quote: await oneclick.previewCrossChain(p), deposit_address: undefined };
  const q = result.quote;
  console.log(`${live ? "LIVE quote" : "Preview (dry, nothing committed)"}: NEAR USDC → Base USDC`);
  console.log(`  in:   ${q.amountInFormatted} USDC ($${q.amountInUsd}) from refund account ${p.refund_to}`);
  console.log(`  out:  ${q.amountOutFormatted} USDC ($${q.amountOutUsd}), at least ${q.minAmountOut} units, to ${p.recipient}`);
  console.log(`  time: about ${q.timeEstimate} s`);
  if (live) {
    console.log(`  deposit address: ${result.deposit_address}`);
    console.log(`  deadline:        ${q.deadline}`);
    console.log(`\nFurqaan sends exactly ${q.amountInFormatted} USDC (ft_transfer on ${NEAR_USDC.slice(7)}) to the deposit address before the deadline.`);
    console.log(`Mainnet: both owners say yes first. Then: pnpm kt4 submit ${result.deposit_address} <tx_hash>; pnpm kt4 status ${result.deposit_address}`);
  }
} else if (command === "submit") {
  const [deposit, txHash] = rest;
  if (!deposit || !txHash) throw new Error("usage: pnpm kt4 submit <deposit_address> <tx_hash>");
  await oneclick.submitDeposit(deposit, txHash);
  console.log(`submitted ${txHash} for ${deposit}`);
} else if (command === "status") {
  const [deposit] = rest;
  if (!deposit) throw new Error("usage: pnpm kt4 status <deposit_address>");
  const started = Date.now();
  let last = "";
  for (;;) {
    const s = await oneclick.trackDeposit(deposit);
    if (s.status !== last) console.log(`${new Date().toISOString()} ${s.status}${s.dest_tx_hash ? ` → Base tx ${s.dest_tx_hash}` : ""}`);
    last = s.status;
    if (DONE.includes(s.status)) {
      console.log(s.status === "SUCCESS" ? `KT4 PASS: delivered in ${Math.round((Date.now() - started) / 1000)} s of polling` : `KT4 not passed: ${s.status}`);
      break;
    }
    if (Date.now() - started > 15 * 60_000) {
      console.log("still not settled after 15 minutes; run status again later");
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
} else {
  throw new Error(`unknown command ${command}: preview, quote, submit or status`);
}
