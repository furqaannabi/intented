# The mainnet wallet is `intented-wallet.near`, and keeps its full-access key until it's taken down

2026-11-09 · Decided by William; Furqaan to confirm before the deploy, which needs both yeses anyway · Status: accepted. Supersedes the account name in [one mainnet wallet](./2026-11-06-one-mainnet-wallet.md); changes steps 2, 6 and 9 of the [runbook](../mainnet-runbook.md)

## Context

The runbook created `wallet.intented.near` from `intented.near`. On 9 November William didn't have `intented.near`'s private key (it wasn't on his machine), and Furqaan had no NEAR to run the deploy ([record](./2026-11-09-william-runs-the-mainnet-runbook.md)). William funds the mainnet run himself, and wants the NEAR back afterwards. About 3.3 NEAR of the 4.3 needed is the wallet's storage, which step 9 would lock for good by deleting the wallet's full-access key.

## Decision

- The mainnet wallet is `intented-wallet.near`, a top-level account William creates and holds the key to. Free on 9 November.
- Step 9 is skipped: the wallet keeps its full-access key. After judging, the owner withdraws the USDC and the accounts are deleted, which returns their NEAR.
- The wallet is funded with 3 USDC, not 5: about 2.03 for the 2 USDC payment to Base, the rest for one retry. The refused attack moves nothing. The caps stay at 5 USDC a payment and 10 a day, so the 4 USDC attack is refused by the verdict, not the cap.
- Every account that can receive money is William's: the wallet, the owner, the agent, the vendor on NEAR, and the vendor's Base address.

## Consequences

- While it exists, whoever holds the wallet's full-access key can replace its contract and bypass every check. The README says so for this wallet, as it does for `intented-wallet.testnet`. The checks a judge can run (the code hash against a reproducible build, `check-tx` on each transaction) still hold for what the wallet did.
- Money actually spent: about 0.1 NEAR in gas and 1Click's fee, about 0.02 USDC.
- The mainnet API and site use `CONTRACT_ACCOUNT_ID` and `NEXT_PUBLIC_WALLET_ID` set to `intented-wallet.near`.
