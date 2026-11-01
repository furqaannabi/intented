# Wallet caps count token amounts; the daily window is the UTC day; the allowlist covers receiver contracts

2026-11-01 · Decided by Furqaan · Status: accepted (the owner setter methods below need William's agreement before they enter the interface spec)

## Context

The trust model makes the contract's caps the backstop: the model can only tighten what the contract permits. The demo pays USDC with `ft_transfer`, whose `deposit` is 1 yoctoNEAR; the real amount is `args.amount`. A cap on `deposit` alone would never limit the payment the demo makes. The interface spec lists the caps, the allowlist and the freeze switch but not how they count, reset or are set.

## Decision

- **Caps per token, in the token's smallest unit.** The owner sets a per-transaction and a daily cap for each token contract. For `ft_transfer` and `ft_transfer_call`, the contract reads `amount` from the stored `args_json` and checks it against that token's caps. A token method on a contract with no caps set, or args with no readable `amount`, is rejected.
- **A NEAR cap on `deposit`**, per transaction and daily, in yoctoNEAR, applied to every action.
- **The daily window is the UTC calendar day**, `block_timestamp_ms / 86_400_000`. Spending resets at 00:00 UTC.
- **The allowlist covers receiver contracts** (`receiver_id`), not payees. 1Click quotes a fresh deposit address per payment, so a payee allowlist would block the demo. The model judges the payee; the caps bound the damage.
- **The agent is an account.** `propose` and `execute` accept calls only from `agent_id`, set at init. Its function-call key lives on that account, scoped to the wallet contract, as tested in KT2.
- **Owner setters** the spec does not list yet: `allow_receiver`, `disallow_receiver`, `set_token_caps`, `set_near_caps`. `revoke_signer` takes the address. These are proposed as a spec revision, pending William.

## Consequences

- The contract parses JSON args for token transfers, a small amount of extra code and gas.
- Spend can reach twice the daily cap across a UTC midnight. Accepted for a hackathon; a rolling window would need every spend stored.
- Daily caps are third on the cut list; if they are cut, the per-transaction caps and the allowlist remain.
