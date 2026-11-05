# Accepted: the demo agent holds its own key, and the API holds none

2026-11-05 · Decided by Furqaan, William · Status: accepted

## Context

William proposed [that the demo agent hold `intented-agent.testnet`'s key itself, that payments through 1Click get a quote step, and that `POST /api/propose` and `AGENT_PRIVATE_KEY` leave the API](./2026-11-05-demo-agent-holds-its-own-key.md). It adds `POST /api/quote` and `POST /api/executed`, gives `POST /api/verdict` an optional `quote_id`, and removes `POST /api/propose`, so it needed Furqaan's agreement.

Furqaan's answer, 5 November:

> Yes to 2026-11-05-demo-agent-holds-its-own-key. Go ahead with the acceptance record, the spec rows and the order you set out.

He added three things:

1. If `AGENT_PRIVATE_KEY` was ever set on a hosted environment, he replaces the key on `intented-agent.testnet` once the demos have moved, and sends the new one through the password manager. If it was only ever on William's machine, nothing to do.
2. `POST /api/quote` gets a cap across all wallets as well as the per-wallet one, to protect the 1Click JWT's quota.
3. The README says "the API holds no key" only after `POST /api/propose` and the key are gone. If the 8 November fallback happens, it says the 1Click demos still go through the API's key until they move.

## Decision

- **The proposal is accepted as written**, in the order it sets out: the spec rows; `POST /api/executed`, `POST /api/quote`, then `quote_id` on `POST /api/verdict`, one at a time with tests; the demo agent moves over; all four demos run on testnet; then `POST /api/propose` and the key are removed.
- **`POST /api/quote` is capped twice:** 30 quotes per wallet per hour, and 120 per hour across all wallets. Past either, `429` with `Retry-After`.
- **The README's claim follows the code.** "The API holds no key" appears only once the key is removed. With the fallback, it says the 1Click demos still go through the API's key.
- **Key rotation:** William tells Furqaan, once the demos have moved, whether `AGENT_PRIVATE_KEY` was ever set anywhere but his machine. If it was, Furqaan replaces the key.

## Consequences

- The spec gains `POST /api/quote` and `POST /api/executed`, `POST /api/verdict` gains `quote_id`, and `POST /api/propose` is marked for removal. Its row goes when the endpoint does.
- The contract, the firewall core and the judge request don't change.
