# Accepted: execute verifies 1Click's signed quote, over the fields 1Click actually signs

2026-11-03 · Decided by Furqaan, William · Status: accepted

## Context

Furqaan proposed [that `execute` verify 1Click's signed quote](./2026-11-03-execute-verifies-the-1click-quote.md), so the deposit address is no longer the API's word: without it, whoever holds the agent key and a NEAR AI key can name any NEAR account as the deposit address and get a genuine `ALLOW`. The proposal needed William's agreement, because the API builds the field and the testnet stand-in must sign quotes.

William accepted on condition that a real quote's signature verifies first, since the whole check rests on the payload format. One live mainnet quote was fetched (0.4 USDC to the vendor's Base address, paid in wNEAR; no deposit was made) and checked off-chain with `node:crypto` alone:

- Built as the proposal describes, from the whole response, `stable_json({ ...quoteRequest, ...quote, timestamp })`, the signature **does not verify**.
- Built from the field lists in 1Click's SDK (`@defuse-protocol/one-click-sdk-typescript` 0.1.26, `buildSignedQuoteRequest` and `buildSignedQuote`), it **verifies** with the manager key `ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc`. Changing one character of the deposit address makes it fail.

The key, the hash (`base58(sha256(json-stable-stringify(…)))`, signed as UTF-8) and the ed25519 scheme in the proposal are right. Only the set of fields is not.

## Decision

- **Furqaan's proposal is accepted**: `cross_chain.signed_quote: { payload, signature }`, the owner's `set_one_click_key(public_key)`, and the extra `execute` checks, as in his record.
- **The payload is built from 1Click's signed field lists, not the whole response.** In SDK 0.1.26:
  - from the request: `dry`, `swapType`, `slippageTolerance`, `originAsset`, `depositType`, `destinationAsset`, `amount`, `refundTo`, `refundType`, `recipient`, `recipientType`, `deadline`, and when set, `quoteWaitingTimeMs`, `referral`, `virtualChainRecipient`, `virtualChainRefundRecipient`, `customRecipientMsg`;
  - from the quote: `amountIn`, `amountInFormatted`, `amountInUsd`, `minAmountIn`, `amountOut`, `amountOutFormatted`, `amountOutUsd`, `minAmountOut`, and when set, `depositAddress`, `depositMemo`, `deadline`, `timeWhenInactive`, `timeEstimate`, `refundFee`, `withdrawFee`;
  - and the response's `timestamp`. Keys left unset are dropped, and keys are sorted.

  `depositMode`, `confidentiality`, `insured` and `appFees` are in the request but never signed.
- **The API builds the payload** with these lists and checks the signature itself before proposing, so a quote that won't verify never reaches the judge. The contract needs no change for this: it verifies whatever payload it is given and reads its fields, and every field it checks is in the signed lists.
- **The testnet stand-in signs its quotes the same way, with its own ed25519 key**, which the owner registers on the testnet wallet. Every delivery it reports stays `simulated`.

## Consequences

- If 1Click changes which fields it signs, every real payment fails the check, closed, with no funds moved. So the API's tests use the live quote as a fixture, and one fresh live quote is verified again before the mainnet deploy.
- The four unsigned request fields can't be relied on. None of them decides who is paid or how much: the recipient, the deposit address, the assets, `amountIn`, `amountOut` and `refundTo` are all signed.
- What is still not verified stays as Furqaan's record says: that 1Click delivers, and the quote's freshness.
