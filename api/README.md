# api

The HTTP API the web app and the demo agent use, proposal storage, and the 1Click module. **Owner: William.** Hono and node:sqlite ([record](../docs/decisions/2026-11-01-api-hono-and-node-sqlite.md)); the pipeline's behaviour is in [this record](../docs/decisions/2026-11-01-api-pipeline-behaviour.md), the cross-chain design in [this one](../docs/decisions/2026-11-03-cross-chain-through-1click.md).

## Run

Needs Node 24 and pnpm 11, and `.env` at the repo root (names in [`.env.example`](../.env.example)).

```sh
pnpm install
pnpm start      # http://localhost:8787
pnpm test
```

It reads `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_AI_API_KEY`, `NEAR_AI_MODEL`, `CONTRACT_ACCOUNT_ID`, `AGENT_ACCOUNT_ID`, `AGENT_PRIVATE_KEY` (a function-call key scoped to the wallet), `AGENT_API_TOKEN`, `WEB_ORIGINS`, `TRUST_PROXY`, `DATABASE_PATH`, `PORT`, and for 1Click `ONECLICK_JWT`, `ONECLICK_BASE_URL` and, off mainnet, `ONECLICK_STANDIN_PUBLIC_KEY`. It logs proposal ids, statuses and transaction hashes, never keys, tokens or prompts.

## Endpoints

The shapes are in [the interface spec](../docs/interface-spec.md).

| Endpoint | Who | What |
| --- | --- | --- |
| `POST /api/mandate` | anyone | Stores a mandate text and returns its sha256. Nothing changes on-chain until the owner calls `set_mandate`. A text already stored gets its stored `mandate_id` back. New texts are limited to 5 a minute per client and 30 a minute in all; over that, `429` with `Retry-After` |
| `GET /api/mandates/:text_hash` | anyone | The stored text with that hash |
| `POST /api/propose` | the agent (`AGENT_API_TOKEN`) | Stores a proposal and starts the pipeline; returns at once. With an `Idempotency-Key` header, a retry with the same key and body gets the first `proposal_id` back; the same key with another body is a `409`. Without one, a retry with the same nonce gets the first `proposal_id`, and a different action reusing a nonce is a `409` ([record](../docs/decisions/2026-11-04-accept-idempotency-key.md)) |
| `GET /api/proposals?since=` | anyone | Proposals changed after a time, oldest change first |
| `GET /api/proposals/:id` | anyone | One proposal |
| `GET /api/redteam/latest` | anyone | The published red-team run, [`redteam/latest.json`](../redteam/latest.json) |

## The pipeline

For each proposal, in the background:

1. Read the wallet's config. Stop before any NEAR AI call unless the wallet's mandate hash, model and prompt hash match this API's.
2. Judge: the firewall core's `judge()` makes the NEAR AI call and checks the TEE signature over the exact request and response.
3. `propose` and then `execute` on-chain, `DENY` included: the wallet's refusal is the proof. On-chain steps run one at a time, so the agent key's nonces never race.
4. If a step throws, or the API restarts mid-way, the outcome is read from the wallet's own record, never guessed.

## Cross-chain propose

A payment through 1Click, to **USDC on Base only**. The agent sends the second body:

```
{ mandate_id, cross_chain: { token, amount, dest_chain, dest_asset, recipient }, context }
```

`amount` is what the recipient receives. The API then:

1. Gets an exact-output 1Click quote. The wallet is always the refund account.
2. Builds the `ft_transfer` of the quoted input to the deposit address, expiring well before the quote's deadline. The agent never picks a deposit address.
3. Fills the judge request's `cross_chain` field from the quote (the Base recipient, what it receives, the deadline), so the judge sees who is really paid.
4. Stores `oneclick` on the proposal. A retry with the same `Idempotency-Key` gets this proposal back with no second quote; without a key, a retry is a second quote and a second payment. It is marked `simulated` on any network but mainnet.
5. After execute, tells 1Click the deposit's transaction and follows the deposit until `SUCCESS`, `REFUNDED` or `FAILED`, after a restart too.

Before proposing, the API checks 1Click's signature on the quote, the same check the wallet makes, and answers `502` if it fails, so a bad quote never reaches the judge.

1Click runs on mainnet only. On mainnet, quotes come from 1Click and are checked with its key. On any other network the route is on only when `ONECLICK_BASE_URL` points at the stand-in in [`agent/`](../agent/README.md) and `ONECLICK_STANDIN_PUBLIC_KEY` is set (`pnpm oneclick-key` writes both keys); otherwise a cross-chain propose gets a `501`, so a testnet API never quotes against the real 1Click. The server's startup log says which.

## KT4

`pnpm kt4 preview|quote|submit|status` runs one real 1Click payment from NEAR USDC to Base USDC, step by step. The script never moves funds: the payment itself is a mainnet transfer, and it waits on a yes from both owners.

## Limits

- The mandate rate limit is kept in memory, so it resets when the API restarts. Behind a host's proxy, set `TRUST_PROXY=1` so the client is read from `X-Forwarded-For` (the address the proxy appended last). If that address is the proxy's own, every client shares the per-client limit, and the cap of 30 a minute still holds.
- The contract checks the transfer to the deposit address. That 1Click delivers to the recipient is 1Click's word, checked afterwards through its status.
- On testnet, every quote shares the stand-in's one deposit account, so one cross-chain payment at a time.
