# api

The HTTP API the web app and the demo agent use, proposal storage, and the 1Click module. **Owner: William.** Hono and node:sqlite ([record](../docs/decisions/2026-11-01-api-hono-and-node-sqlite.md)); the pipeline's behaviour is in [this record](../docs/decisions/2026-11-01-api-pipeline-behaviour.md), the cross-chain design in [this one](../docs/decisions/2026-11-03-cross-chain-through-1click.md).

The testnet API is hosted at `https://hack.furqaannabi.com`, on EC2 ([how](../docs/hosting-ec2.md)). The mainnet API is at `https://hack.furqaannabi.com/mainnet`, on the same box.

## Run

Needs Node 24 and pnpm 11, and `.env` at the repo root (names in [`.env.example`](../.env.example)).

```sh
pnpm install
pnpm start      # http://localhost:8787
pnpm test       # 96 tests
```

It reads `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_AI_API_KEY`, `NEAR_AI_MODEL`, `CONTRACT_ACCOUNT_ID`, `FACTORY_ACCOUNT_ID` (default `intented.testnet` on testnet; unset on mainnet, where the API judges only `CONTRACT_ACCOUNT_ID`), `VERDICT_DAILY_CAP` (verdicts across all wallets in any 24 hours; unset, no daily cap; set it on mainnet), `WEB_ORIGINS`, `TRUST_PROXY`, `DATABASE_PATH`, `PORT`, and for 1Click `ONECLICK_JWT`, `ONECLICK_BASE_URL` and, off mainnet, `ONECLICK_STANDIN_PUBLIC_KEY`. It holds no NEAR key and sends no transactions. It logs proposal ids, statuses and transaction hashes, never keys, tokens or prompts.

## Endpoints

The shapes are in [the interface spec](../docs/interface-spec.md).

| Endpoint | Who | What |
| --- | --- | --- |
| `POST /api/mandate` | anyone | Stores a mandate text and returns its sha256. Nothing changes on-chain until the owner calls `set_mandate`. A text already stored gets its stored `mandate_id` back. New texts are limited to 5 a minute per client and 30 a minute in all; over that, `429` with `Retry-After` |
| `GET /api/mandates/:text_hash` | anyone | The stored text with that hash |
| `POST /api/verdict` | anyone | Judges a wallet's pending proposal, read from the chain, and returns the signed verdict ready for the agent's `execute`. 30 per wallet per hour |
| `POST /api/quote` | anyone | A 1Click quote for a payment the agent is about to propose: the deposit address and amount. 30 per wallet and 120 in all per hour |
| `POST /api/executed` | anyone | The agent reports its `execute`; the API checks it on chain, stores the hash, and tells 1Click about a deposit |
| `GET /api/proposals?since=` | anyone | Proposals changed after a time, oldest change first |
| `GET /api/proposals/:id` | anyone | One proposal |
| `GET /api/redteam/latest` | anyone | The published red-team run, [`redteam/latest.json`](../redteam/latest.json) |

## After a verdict

The wallet's agent proposes, asks `POST /api/verdict`, and sends `execute` itself. In the background the API:

1. Settles each judged proposal from the wallet's own record (`get_proposal`), never guessed, after a restart too.
2. For a payment through 1Click, once the agent reports its `execute` through `POST /api/executed`, tells 1Click about the deposit and follows it until `SUCCESS`, `REFUNDED` or `FAILED`.

## Payments through 1Click

To **USDC on Base only**. The agent asks `POST /api/quote` with `{ wallet_id, intent: { token, amount, dest_chain, dest_asset, recipient } }`, where `amount` is what the recipient receives. The API:

1. Refuses before spending a quote if the wallet has cross-chain payments off or accepts another 1Click key. A recipient off the wallet's list is still quoted: the model judges it, and the wallet refuses it at `execute` ([record](../docs/decisions/2026-11-05-quote-skips-recipient-list.md)).
2. Gets an exact-output 1Click quote, with the wallet as the refund account, checks 1Click's signature on it (the same check the wallet makes), and stores it. What the judge is told the recipient gets, `cross_chain.amount_out`, is 1Click's own signed `amountOutFormatted` and the symbol ("2.0 USDC"), because the wallet refuses an `amount_out` that doesn't start with it. A quote whose `amountOutFormatted` isn't the same amount as its `amountOut` is refused.
3. Returns the deposit address, token, input amount and deadline. The agent proposes that `ft_transfer`, expiring before the deadline, and asks `POST /api/verdict` with the `quote_id`.
4. Checks the proposal on chain against the stored quote, then judges with `cross_chain` filled from the quote, so the judge sees who is really paid. A quote serves one proposal. It is marked `simulated` on any network but mainnet.

1Click runs on mainnet only. On mainnet, quotes come from 1Click and are checked with its key. On any other network quoting is on only when `ONECLICK_BASE_URL` points at the stand-in in [`agent/`](../agent/README.md) and `ONECLICK_STANDIN_PUBLIC_KEY` is set (`pnpm oneclick-key` writes both keys); otherwise `POST /api/quote` answers `501`, so a testnet API never quotes against the real 1Click. The server's startup log says which.

## KT4

`pnpm kt4 preview|quote|submit|status` runs one real 1Click payment from NEAR USDC to Base USDC, step by step; the script itself never moves funds. KT4 passed on mainnet on 9 November, through the whole pipeline instead: the wallet paid 1Click on a signed `ALLOW`, and 1Click delivered 2.0 USDC on Base ([record](../docs/decisions/2026-11-09-mainnet.md)).

## On mainnet

The same server, with `NEAR_NETWORK=mainnet`, `CONTRACT_ACCOUNT_ID=intented-wallet.near`, `VERDICT_DAILY_CAP` set, `FACTORY_ACCOUNT_ID` empty (it judges that one wallet only) and its own `DATABASE_PATH`. Quotes come from 1Click itself and are checked with 1Click's key. The `api-mainnet` entry in `.claude/launch.json` runs it on :8788 beside the testnet API.

## Limits

- The mandate rate limit is kept in memory, so it resets when the API restarts. Behind a host's proxy, set `TRUST_PROXY=1` so the client is read from `X-Forwarded-For` (the address the proxy appended last). If that address is the proxy's own, every client shares the per-client limit, and the cap of 30 a minute still holds.
- The contract checks the transfer to the deposit address. That 1Click delivers to the recipient is 1Click's word, checked afterwards through its status.
- On testnet, every quote shares the stand-in's one deposit account, so one cross-chain payment at a time.
