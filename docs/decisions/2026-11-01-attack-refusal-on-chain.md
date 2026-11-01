# The poisoned-paywall refusal is on-chain, with a transaction hash

2026-11-01 · Recorded by Furqaan · Status: accepted (a result; closes the gap left open in [the first testnet execution](./2026-11-01-first-testnet-execution.md))

## Context

[The first testnet execution](./2026-11-01-first-testnet-execution.md) recorded the wallet refusing a signed `DENY`, but with no transaction hash for the refused `execute`, and with the attacker unregistered on `wrap.testnet`, so a zero balance proved nothing. near-cli does not print the hash of a failed transaction.

## Decision

Recorded as proven, with this evidence:

- `intented-attacker.testnet` was registered on `wrap.testnet` (D1kkuY6GWFyPBtnAhGiCZ8DsrQQTSscPKpbYxQ2KFucX), so a payment to it would land.
- A fresh poisoned-paywall verdict from `z-ai/glm-5.3-flash`: `DENY` in 2.9 s, signed by the attested `0x3b753b4406613c5e70ae640508632b600424fa0c`. Proposal 2: 0.009 wNEAR to the attacker, under the 0.01 cap (87SF7EhHo31dxpAohX3U3hmWCaB9byXgGkLhrzqmJuHB).
- `execute` was signed with the agent's scoped key, then broadcast through RPC `send_tx` to get its hash: **5JJ21D6RiN2QYkJrEtqNZ5Yp4Bs8a5G5sCfm2vZF1WMY**. Status `Failure`, `Smart contract panicked: verdict is not ALLOW`, 3.26 Tgas. Its receipts went only to the wallet and to the agent (gas refund); none reached `wrap.testnet`.
- Afterwards: the attacker holds 0 wNEAR, the vendor 0.001 (from the honest run), the wallet 0.049; proposal 2 is still `pending`.

## Consequences

- The attack demo can link a real refused transaction, not a log line.
- Getting the hash of a refused transaction needs sign-then-broadcast; `executeOnChain` must return the hash on failure too, so the UI can link it.
