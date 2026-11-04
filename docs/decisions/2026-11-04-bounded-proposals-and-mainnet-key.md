# Proposals are bounded and prunable; the mainnet wallet's full-access key is deleted after setup

2026-11-04 · Decided by Furqaan · Status: proposed (new `propose` behaviour and new methods need William's agreement; he raised the storage gap)

## Context

William pointed out that proposals were never deleted and their number was unbounded: a leaked agent key could send many small proposals until the wallet's NEAR was locked in storage. With factory wallets, anyone can now create a wallet, and nobody can upgrade one. A refused `execute` reverts, so it can't delete its own proposal; refused proposals stay pending. Separately, the mainnet wallet's full-access key had no owner.

## Decision

- **At most 32 proposals pending.** `propose` refuses a 33rd; a successful `execute` frees its slot.
- **An action may expire at most an hour ahead**, so any stuck proposal becomes prunable within the hour.
- **`prune(proposal_ids)`**, at most 64 per call: anyone may delete a proposal that is executed, failed, or pending and expired; the owner may also delete a pending one before it expires. A proposal being executed (`allowed`) is never deleted. Others are skipped; it returns how many were deleted.
- **Migrated wallets don't count proposals already pending** (the map can't be iterated); those still expire and can be pruned.
- **The factory takes new wallet code with `set_code`**, callable only by the factory account itself. Wallets already made keep theirs. This means whoever holds the factory account's key (the team) chooses the code of future wallets; `get_code_hash()` shows which code a new wallet will get, so a creator can check it first.
- **Our mainnet wallet's full-access key is deleted after setup** on 11 November: deploy, configure, attest and register the signer, fund, run one allowed and one refused payment, then delete the key. Nobody can then replace its contract; `withdraw` gets funds out, and a bug means withdraw and deploy a new wallet.

## Consequences

- A leaked agent key can lock at most 32 proposals' storage, under 1 NEAR, for at most an hour before anyone frees it. Tokens were never at risk.
- The API's actions must expire within an hour.
- Shown on testnet on 4 November: `intented-wallet.testnet` migrated (Gw1RMCcbuHkJapAU2Xf6y99HT3nS8xPtef7D68yZLDyB); a stranger pruned expired and executed proposals (6sDVhvMx5Sg7shcArCSbkjchBg1PMjJmkYC7o1Uqx92C); a stranger's call to `on_executed` was refused as private; the factory's new code hash `Gy6sretTvkChCEbJMfwgPVxesNbW6dKtC4Rp6P72t7jj` matches the local build; `demo2.intented.testnet`, made on it, paid the honest payment (2eebywtFD8vU67C9NS3DSdi6dQRpUYVHSS6ZB1FD4ayp) and refused the poisoned one (6bB1fqJFBSdcPECbNw2BQHmKmDFHusZE1FCyV1WX8H4C).
- `demo.intented.testnet` keeps the earlier code, as every factory wallet keeps its code.
- Tests: 57 in `contract/wallet`, 6 in `contract/factory`; disabling any of the 7 new wallet guards fails a test.
