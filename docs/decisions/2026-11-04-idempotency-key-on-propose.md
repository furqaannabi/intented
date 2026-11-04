# An optional Idempotency-Key on POST /api/propose, so a retried cross-chain payment is sent once

2026-11-04 · Decided by William · Status: proposed (it adds a header to an endpoint in the interface spec, so it needs Furqaan's agreement)

## Context

A client that retries `POST /api/propose`, after a timeout for example, sends the same payment twice.

- **NEAR payments are covered already.** The agent picks the nonce, so a retry carries the same one. The wallet takes each nonce once, and since 4 November the API returns the first proposal for an identical retry and answers `409` for a different action that reuses a nonce, without a second NEAR AI call.
- **Payments through 1Click are not.** For the second body (`cross_chain: { token, amount, dest_chain, dest_asset, recipient }`) the API picks the nonce and gets the quote. A retry is a second quote with its own deposit address, and a second action with its own nonce. Both are honest payments the mandate allows, so both get an `ALLOW` and the wallet pays twice. On testnet the stand-in's single deposit account hides this; on mainnet every quote has its own.

Our agent sends each propose once and never retries it, so the demo is not exposed. A client that retries on a network error is.

## Decision (proposed)

- `POST /api/propose` takes an optional `Idempotency-Key` header: 1 to 64 characters of `A–Z a–z 0–9 _ -`.
- The first request with a key stores the key with its proposal and the sha256 of the body. A later request with the same key and the same body gets that `{ proposal_id }` back: no second quote, no second judge call, nothing on-chain. The same key with a different body is a `409`. A malformed key is a `400`.
- Keys are kept for 24 hours.
- Without the header, nothing changes.
- The demo agent sends a new random key for each purchase, so a retry of that purchase reuses it.

## Consequences

- A retried cross-chain propose can't pay twice, on mainnet included, as long as the client sends a key. The API can't make a client send one; a client without a key keeps today's behaviour.
- The interface spec's `POST /api/propose` row gains the header and the `409`, with a revision row agreed by both owners. The wallet, the firewall core and the judge request don't change.
- `POST /api/mandate` repeats are handled without a key: posting a stored text returns its stored `mandate_id`.
