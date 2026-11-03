# execute verifies 1Click's signed quote, so the deposit address is not the API's word

2026-11-03 · Decided by Furqaan · Status: proposed (it adds a field to `cross_chain` and owner methods, and William's stand-in must sign quotes, so it needs William's agreement)

## Context

[The cross-chain record](./2026-11-03-cross-chain-through-1click.md) puts the Base recipient in front of the judge, but the contract can't check that `cross_chain.deposit_address` delivers to `cross_chain.recipient`; it says that link is the API's word. That reopens what [the request check](./2026-11-01-execute-checks-the-signed-request.md) closed: whoever holds the agent key and any NEAR AI key can name any NEAR account as a "deposit address", put the vendor's Base address as the recipient, and get a genuine `ALLOW`. The money goes to their account, up to the caps.

1Click signs its quotes ([docs](https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature)). From its TypeScript SDK (`@defuse-protocol/one-click-sdk-typescript` 0.1.26, `verifyQuoteSignature`): ed25519, manager key `ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc`, over the UTF-8 bytes of `base58(sha256(stable_json({ ...request, ...quote, timestamp })))`. The signed request fields include `swapType`, `originAsset`, `destinationAsset`, `amount`, `refundTo`, `recipient`, `recipientType` and `dry`; the quote fields include `amountIn`, `amountOut`, `amountOutFormatted`, `depositAddress`, `depositMemo` and `deadline`. NEAR contracts verify ed25519 natively (`env::ed25519_verify`).

## Decision

- **`cross_chain` gains `signed_quote: { payload, signature }`.** `payload` is the exact stable-JSON string 1Click hashes; `signature` is 1Click's `ed25519:…` signature. The API copies both from the quote response.
- **The owner registers the quote key:** `set_one_click_key(public_key)`. On mainnet, 1Click's manager key; on testnet, the stand-in's own key. While it is unset, `execute` refuses any request with `cross_chain`.
- **`execute` verifies, for a request with `cross_chain`,** in addition to the five checks already specified:
  1. the signature verifies over `base58(sha256(payload))` with the registered key;
  2. `payload` parses with no duplicate keys, and `dry` is false, `swapType` is `EXACT_OUTPUT`, `recipientType` is `DESTINATION_CHAIN`, and there is no `depositMemo`;
  3. `depositAddress` equals `cross_chain.deposit_address` and `args.receiver_id`;
  4. `recipient`, lowercased, equals `cross_chain.recipient`; `destinationAsset` equals `cross_chain.dest_asset`;
  5. `originAsset` is `nep141:` plus the token being sent, and `amountIn` equals `args.amount`;
  6. `refundTo` is the wallet itself, so a failed swap returns here;
  7. `cross_chain.amount_out` starts with `amountOutFormatted` and a space.
- **The firewall core** checks the same before any NEAR AI call, so a bad quote fails early.

## Not verified

- That 1Click delivers: the wallet trusts 1Click, as a service, to honour its own signed quote.
- The quote's freshness and `deadline`: the contract does not parse ISO timestamps. An expired quote's deposit is refunded to the wallet (check 6), so no money is lost; `expiry_ms < cross_chain.deadline_ms` stays as specified.
- The token symbol in `amount_out`. A false symbol could mislead the model about value, but cannot change who is paid, which the signature fixes.

## Consequences

- Holding the agent key and a NEAR AI key is again not enough: funds can only go to a deposit address that 1Click signed for this recipient, with refunds to the wallet.
- On testnet the stand-in must sign quotes the same way with its own key; every delivery it reports stays `simulated`.
- About a day of work in `contract/` and `firewall-core/`, after the five base checks. If time runs short, the recipient list is cut first and this check second; without it, the README says the deposit address is trusted from the API.
