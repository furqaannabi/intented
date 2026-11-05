# The demo agent holds its own key, and the API holds none

2026-11-05 · Decided by William · Status: proposed (it adds two endpoints to the interface spec, extends `POST /api/verdict` and removes `POST /api/propose`, so it needs Furqaan's agreement)

## Context

- **The API still holds an agent key.** On the demo wallet's path, `POST /api/propose` judges a payment and then sends `propose` and `execute` itself, with `AGENT_PRIVATE_KEY` for `intented-agent.testnet`. The API will run on a public host. A host that holds a key that can move the demo wallet's money is the one thing that contradicts "the API only judges".
- **The new path works.** Since 4 November `POST /api/verdict` judges a proposal the wallet's own agent made, and the agent sends `execute` itself ([accepted](./2026-11-04-accept-verdict-for-any-wallet.md)). On 5 November `pnpm intented pay` used it on `retest-1104.intented.testnet`: an `ALLOW` was paid (tx `4rddy8CUvMfzJjxVALZdMPNmZ7W8ofKB5KERee66X2og`), and a `DENY` for an injected recipient was refused on chain (tx `62h7SnsLzY9vmXZj2Nhu3roHhRDvSEuYi8WVqM1fcVPC`).
- **That record left two things for this one.** Moving the demo wallet over and removing `AGENT_PRIVATE_KEY` before feature-complete on 10 November. And payments through 1Click: on the new path they need a quote step before `propose`.
- **Why a quote step.** For a payment through 1Click the API asks 1Click for a quote, the `ft_transfer` goes to the quote's deposit address, and the judge request carries `cross_chain` with 1Click's signed quote. The spec says the firewall fills `cross_chain` from the quote, never the agent. On the new path the agent builds and proposes the `ft_transfer` itself, so it needs the deposit address before it proposes.
- **Why the API needs the execute transaction.** After `execute`, the API tells 1Click about the deposit (`/v0/deposit/submit`, with the transaction hash) and follows it to delivery. Real 1Click finds a deposit by itself; the testnet stand-in needs to be told. On the new path the API never sees that transaction. The same gap leaves receipts on the new path without an execute link.
- **Who calls `POST /api/propose` today:** only `agent/` (`pnpm agent honest`, `poisoned`, `base`, `base-poisoned`). The red team calls the firewall core's `judge()` directly, and the web app doesn't call it.

## Decision (proposed)

**The demo agent holds `intented-agent.testnet`'s function-call key**, on the machine it runs on, as factory wallets' agents do. It moves from the API's environment to the agent's. `pnpm agent honest`, `poisoned`, `base` and `base-poisoned` keep their names and their paywalls. Each one proposes on `intented-wallet.testnet` with that key, asks `POST /api/verdict`, and sends `execute` itself.

**`POST /api/quote`, new.** `{ wallet_id, intent: { token, amount, dest_chain, dest_asset, recipient } }`, the intent as `POST /api/propose`'s cross-chain body takes it today. The API asks 1Click for a live quote and stores it. It returns `{ quote_id, deposit_address, token, amount_in, deadline_ms, amount_out }`: the agent proposes an `ft_transfer` of `amount_in` of `token` to `deposit_address`, expiring before `deadline_ms`. `409` if the wallet has cross-chain payments switched off or the recipient isn't on its list. `429` with `Retry-After` past 30 quotes per wallet per hour. `501` when the API has no 1Click client.

**`POST /api/verdict` takes an optional `quote_id`.** With it, the API checks the proposal on chain against its stored quote before judging: an `ft_transfer` of the quote's token and `amount_in` to its deposit address, expiring before its deadline. It then judges with the `cross_chain` field built from that quote, as `POST /api/propose` does today. A quote is used for one proposal only. `409` if the quote is unknown, used, past its deadline, for another wallet, or doesn't match the proposal.

**`POST /api/executed`, new.** `{ wallet_id, proposal_id, near_tx_hash }`, sent by the agent after `execute`. The API looks the transaction up on chain. It must be a successful call to that wallet's `execute` with that `proposal_id`, signed by the wallet's agent. Then the API stores the hash, so the receipt links to it, and for a payment through 1Click tells 1Click about the deposit and follows it. It is optional for correctness: the API settles every proposal from the wallet's own record (`get_proposal`) either way.

**Removed from the API:** `POST /api/propose` (both bodies), its `Idempotency-Key`, and the environment variables `AGENT_PRIVATE_KEY`, `AGENT_ACCOUNT_ID` and `AGENT_API_TOKEN`. Proposals already stored keep their `near_tx_hash` and receipts.

**Order, before 10 November:** the record is accepted; the spec rows; then one endpoint at a time with tests: `POST /api/executed`, `POST /api/quote`, then `quote_id` on `POST /api/verdict`. Then the demo agent moves over, all four demos run on testnet, and only then `POST /api/propose` and the key are removed.

## Alternatives weighed

- **Move the NEAR payments, keep 1Click on `POST /api/propose`.** Cheapest, and every demo keeps working, but the API keeps `AGENT_PRIVATE_KEY`, which is what this record is for.
- **Move the NEAR payments and stop running the 1Click ones.** Removes the key with no new endpoints, and the cut list drops the cross-chain leg first. But the Base attack stops being something a judge can run; only its recorded transaction would remain.

## Consequences

- **The API holds no key at all.** It can't send a transaction or move money for any wallet, the demo included. It holds the NEAR AI key and the 1Click JWT, as today.
- **Unchanged:** the contract, the firewall core and the judge request. `cross_chain` is still filled by the API from its own stored quote, never by the agent. Every `execute` check applies as before, and the caps are still the backstop.
- **The quote endpoint spends 1Click quotes, not NEAR AI calls.** It is open like `POST /api/verdict` and rate-limited per wallet. A quote only names a deposit address. Nothing moves until the wallet's own agent proposes and executes with a signed `ALLOW`.
- **Receipts on the new path get their execute link**, once the agent reports it through `POST /api/executed`. If it never does, the receipt has no link, and the status is still correct.
- **Watch:** the deadline. If this slips past 8 November, fall back to the first alternative for the 1Click demos and remove the key once they move.
- **The demo's key moves to wherever the demo agent runs.** For the recording that's William's machine. Like every key, it lives in the password manager, never in the repo.
