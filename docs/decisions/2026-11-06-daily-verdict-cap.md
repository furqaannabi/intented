# The API caps verdicts across all wallets in any 24 hours, set by VERDICT_DAILY_CAP

2026-11-06 · Decided by William · Status: accepted

## Context

[The mainnet runbook](../mainnet-runbook.md) asks for "a daily verdict cap" on the mainnet API, and [phase 2](../phase-2.md) plans it for 8 November. Neither says what it counts or how big it is.

`POST /api/verdict` is open: anyone may ask for the verdict on a wallet's pending proposal. Each new judgement is a paid NEAR AI call. A repeat gets the stored answer and costs nothing. On mainnet the API judges only `wallet.intented.near`, and only its agent's key can create a proposal there, so abuse is already bounded. The existing limit is 30 verdicts per wallet and 300 in all per hour, which still allows thousands a day.

Three shapes were weighed:

- **A setting, rolling 24 hours.** `VERDICT_DAILY_CAP` counts judgements across all wallets over the last 24 hours. Unset means no cap.
- **A setting, per UTC day.** The same, but the count resets at 00:00 UTC. Easier to explain, but a burst either side of midnight gets the cap twice.
- **A fixed cap in code**, on mainnet only. No setting to get wrong, but changing the number needs a deploy.

## Decision

- `VERDICT_DAILY_CAP=<n>` caps the verdicts the API judges across all wallets in any 24 hours, kept in memory like the hourly limit. It applies on top of the hourly limit, not instead of it.
- Past it, `POST /api/verdict` answers `429` with `Retry-After`, the seconds until the oldest judgement in the window leaves it. A verdict already given is still answered, since it costs no NEAR AI call.
- Unset, there is no daily cap, so testnet is unchanged. The server refuses to start if the value isn't a whole number above 0, and logs whether a cap is on.
- On mainnet it is set. About 50 covers the demo payments, the attack, retries and visitors, at a bounded cost.

## Consequences

- A day's NEAR AI spend on mainnet has a known ceiling, whoever calls the API.
- The count lives in memory, so a restart clears it. A restart takes a deploy, so this is accepted.
- Once the cap is reached, the demo agent's next payment waits too. Before recording on mainnet, check the API's log for the cap, and restart it if the count needs clearing.
