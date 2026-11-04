# Accepted: an optional Idempotency-Key on POST /api/propose, with 409 and 429 in the spec

2026-11-04 · Decided by Furqaan, William · Status: accepted

## Context

William proposed [an optional `Idempotency-Key` on `POST /api/propose`](./2026-11-04-idempotency-key-on-propose.md): a retried cross-chain propose gets a second quote and a second action, and on mainnet the wallet would pay twice. It adds a header to an endpoint in the interface spec, so it needed Furqaan's agreement.

Furqaan agreed, for this reason: a retry gets a new quote, so a new action and a new nonce, and the wallet's nonce check can't tell it from a second purchase. Only the API can. Until the key exists, the wallet's daily cap is the only limit on the damage. The change touches nothing in his lane.

## Decision

- **The proposal is accepted as written.** `POST /api/propose` takes an optional `Idempotency-Key` header of 1 to 64 characters of `A–Z a–z 0–9 _ -`, for both bodies. The same key with the same body gets the first `{ proposal_id }` back, with no second quote, judge call or transaction. The same key with a different body is a `409`, and a malformed key a `400`. Keys are kept for 24 hours. Without the header, nothing changes. The demo agent sends a new key for each purchase.
- **The spec also lists the status codes the API already answers:**
  - `POST /api/propose`: a retry with the same nonce gets the first `{ proposal_id }`; a different action reusing a nonce is a `409`.
  - `POST /api/mandate`: a text already stored gets its stored `mandate_id`; over the rate limit is a `429` with `Retry-After`.

## Consequences

- A retried cross-chain propose can't pay twice when the client sends a key. A client without one keeps the old behaviour, and the daily cap stays the backstop.
- The NEAR nonce guard stays as a second layer: a retry without a key still can't be judged or sent twice.
- The wallet, the firewall core and the judge request don't change.
