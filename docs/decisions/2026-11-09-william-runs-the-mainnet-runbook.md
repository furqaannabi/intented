# William runs the mainnet runbook

2026-11-09 · Decided by Furqaan, William · Status: accepted

## Context

The [mainnet runbook](../mainnet-runbook.md) and mainnet deploys were Furqaan's. On 9 November Furqaan had no NEAR to fund the mainnet accounts, and said William could run the deploy instead. William holds the NEAR for it. The mainnet wallet is wanted in time for the demo video.

## Decision

- William runs the runbook, sections 1 to 10: the preflight, the accounts, `deploy-wallet.sh`, the cross-chain settings, the agent's key, funding, the mainnet API and site, the two payments, deleting the wallet's full-access key, and the record.
- Nothing else in the runbook changes: the budget ($20–50), the accounts, the token and caps, the mandate, a yes from both owners before each step that writes to mainnet, and a person, not an agent, running every step that moves money.
- `contract/` stays Furqaan's. William deploys the code as it is on `main`, with the wasm hash from the preflight, and changes nothing in it.

## Consequences

- The keys for `intented.near`, `intented-owner.near` and `intented-vendor.near` are made or used on William's machine and go to the shared password manager, as the runbook says. None go in the repo.
- If the contract needs a fix, Furqaan makes it, and the deploy waits.
- The 11 November record (`2026-11-11-mainnet.md`, runbook section 10) names William as the one who ran it.
