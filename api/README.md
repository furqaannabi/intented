# api

The HTTP API the web app and the demo agent use, proposal storage, and the 1Click module. **Owner: William.** Hono and node:sqlite ([record](../docs/decisions/2026-11-01-api-hono-and-node-sqlite.md)); the pipeline's behaviour is in [this record](../docs/decisions/2026-11-01-api-pipeline-behaviour.md), the cross-chain design in [this one](../docs/decisions/2026-11-03-cross-chain-through-1click.md).

## Run

Needs Node 24 and pnpm 11, and `.env` at the repo root (names in [`.env.example`](../.env.example)).

```sh
pnpm install
pnpm start      # http://localhost:8787
pnpm test
```

It reads `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_AI_API_KEY`, `NEAR_AI_MODEL`, `CONTRACT_ACCOUNT_ID`, `AGENT_ACCOUNT_ID`, `AGENT_PRIVATE_KEY` (a function-call key scoped to the wallet), `AGENT_API_TOKEN`, `WEB_ORIGINS`, `DATABASE_PATH`, `PORT`, and for 1Click `ONECLICK_JWT` and `ONECLICK_BASE_URL`. It logs proposal ids, statuses and transaction hashes, never keys, tokens or prompts.

## Endpoints

The shapes are in [the interface spec](../docs/interface-spec.md).

| Endpoint | Who | What |
| --- | --- | --- |
| `POST /api/mandate` | anyone | Stores a mandate text and returns its sha256. Nothing changes on-chain until the owner calls `set_mandate` |
| `GET /api/mandates/:text_hash` | anyone | The stored text with that hash |
| `POST /api/propose` | the agent (`AGENT_API_TOKEN`) | Stores a proposal and starts the pipeline; returns at once |
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
4. Stores `oneclick` on the proposal. It is marked `simulated` on any network but mainnet.
5. After execute, tells 1Click the deposit's transaction and follows the deposit until `SUCCESS`, `REFUNDED` or `FAILED`, after a restart too.

**It is off.** Until the firewall core's `judge()` puts `cross_chain` in the request, a cross-chain propose gets a `501`. The line that turns it on is in [`src/server.ts`](./src/server.ts).

On testnet, `ONECLICK_BASE_URL` points at the stand-in in [`agent/`](../agent/README.md), since 1Click runs on mainnet only.

## KT4

`pnpm kt4 preview|quote|submit|status` runs one real 1Click payment from NEAR USDC to Base USDC, step by step. The script never moves funds: the payment itself is a mainnet transfer, and it waits on a yes from both owners.

## Limits

- The contract checks the transfer to the deposit address. That 1Click delivers to the recipient is 1Click's word, checked afterwards through its status.
- On testnet, every quote shares the stand-in's one deposit account, so one cross-chain payment at a time.
