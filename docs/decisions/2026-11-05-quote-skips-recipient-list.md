# POST /api/quote doesn't check the cross-chain recipient list

2026-11-05 · Decided by William, agreed by Furqaan · Status: accepted

## Context

[The accepted quote step](./2026-11-05-accept-demo-agent-own-key.md) had `POST /api/quote` return `409` when the recipient wasn't on the wallet's cross-chain recipient list. That stopped `pnpm agent base-poisoned` at the API: the attack never reached the model or the contract, so the demo showed neither refusing it.

## Decision

`POST /api/quote` no longer checks the recipient list. A recipient off the list is quoted. The model judges the payment against the mandate, and the contract refuses it at `execute` if the recipient isn't on the list. `409` for cross-chain payments switched off, and the quote caps, stay.

## Consequences

- No loss of safety: the contract enforced the list at `execute` before this change and still does. The API check only saved a 1Click quote.
- A quote can now be spent on a payment the wallet will refuse. The caps (30 per wallet, 120 in all, per hour) bound that.
