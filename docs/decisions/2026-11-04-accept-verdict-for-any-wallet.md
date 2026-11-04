# Accepted: POST /api/verdict judges any factory wallet's proposals, and the agent sends its own transactions

2026-11-04 · Decided by Furqaan, William · Status: accepted

## Context

William proposed [that the API judge any factory wallet's proposals while the agent sends its own `propose` and `execute`](./2026-11-04-verdict-for-any-wallet.md). Wallets made by the factory couldn't get a verdict: today's path sends the transactions with the API's own agent key, which only `intented-wallet.testnet` has. The proposal adds an endpoint and a `Proposal` field to the interface spec, so it needed Furqaan's agreement.

The agent's side was built and tried first. On 4 November an agent proposed on `william-test-1104.intented.testnet` with its own key, made by `intented init` on its machine (tx `2jF1cMsxhn7zNKWaR1sDvm1s8eEvC5ZGzKLvkSQjmUyx`), and the wallet refused an unsigned verdict for it (tx `4xjkjQ7iTSYEvxX2PwjJDN7a55JfU5g9DWt4TL72DwKS`).

Furqaan's answer, 4 November:

> Verdict API: yes, as proposed. Go ahead with the acceptance record and the spec rows (POST /api/verdict, wallet_id on Proposal, ?wallet=). One thing for the README's "the model can be wrong" line: a compromised agent can re-propose the same action and get up to 30 tries an hour. That's the same as today's path and bounded by the caps, but worth saying.

On the agent's key he agreed that the agent makes its own on its machine and prints a `/create?key=ed25519:…` link, with no keys made in the browser.

## Decision

- **The proposal is accepted as written.** The agent calls `propose` on its wallet with its own key, then `POST /api/verdict` with `{ wallet_id, proposal_id, context }`, then `execute` itself. The API reads the action from the chain, checks the wallet and the proposal before it spends a NEAR AI call, judges once per proposal, and returns the signed verdict with `req_bytes` and `resp_bytes` ready for `execute`. At most 30 verdicts per wallet per hour.
- **The spec gains** a `POST /api/verdict` row, `wallet_id` on `Proposal`, and `?wallet=` on `GET /api/proposals`.
- **The README says** that a compromised agent can re-propose the same action and get up to 30 verdicts an hour per wallet, as on today's path, and that the contract's caps still bound what a wrong `ALLOW` can cost.

## Consequences

- Every factory wallet can get verdicts, and the API holds no key for any of them.
- The contract, the firewall core and the judge request don't change; every `execute` check applies as before.
- Retries are bounded by the rate limit, by the 32 pending proposals a wallet holds, and by the gas each `propose` costs the wallet, not prevented. The caps remain the backstop.
- The demo wallet keeps today's `POST /api/propose` path until the new one works end to end; a later record covers moving it over and removing `AGENT_PRIVATE_KEY` from the API.
