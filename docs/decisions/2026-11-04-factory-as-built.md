# The wallet factory as built on testnet: stored code, the wallet as its own agent

2026-11-04 · Decided by Furqaan · Status: proposed with [the factory record](./2026-11-04-wallet-factory-on-testnet.md), which it amends; both need William's agreement

## Context

[The factory record](./2026-11-04-wallet-factory-on-testnet.md) planned the wallet code as a global contract by hash. Deploying global code burns 10 NEAR per 100 KB ([NEAR docs](https://docs.near.org/smart-contracts/tutorials/factories/global-contracts.md)): about 32 NEAR for the 317 KB wallet, against 10 NEAR per testnet faucet account.

## Decision

- **The factory stores the wallet code** (`contract/factory`, at `intented.testnet`), fixed at init, and deploys it into each wallet. `get_code_hash()` returns base58(sha256(code)), the form NEAR shows as an account's `code_hash`. The factory's storage locks about 3.3 NEAR; each wallet locks its own code's storage from the owner's deposit (`get_min_deposit()`, 3.76 NEAR on 4 November). Global code by hash stays the plan for a mainnet factory.
- **`create(name, model_id, setup, agent_key?, agent_allowance?)`**, payable: one batch creates `<name>.intented.testnet`, transfers the deposit, deploys the code, calls the wallet's new `new_with(owner_id, agent_id, model_id, setup)` with the caller as owner, and, if a key is given, adds it as a function-call key scoped to `propose` and `execute` on the wallet. No full-access key. If the batch fails, `on_created` refunds the owner.
- **The wallet is its own agent.** The factory passes the wallet's own account as `agent_id`, so the key it adds passes the existing caller check; `propose` and `execute` are unchanged.
- **`propose` refuses an action whose receiver is the wallet itself**, so a wallet that is its own agent can't be made to call its own methods through a judged action.

## Consequences

- Shown on testnet on 4 November: `create` made `demo.intented.testnet` (CqT1LGyWt1zhXLSSGPNyE3eadPB6SHkTR6MHtjEyxFSL) with code hash `8nyHxPHdicQLXhYYPc2pY5KTuo97YBu5FWc57ZZK5fLs`, the factory's, and one access key, the agent's function-call key. The honest payment executed (HNRq1HiXRVgPyevDKBZgRsEZQM9xDjRKRmY4aF7fPqw9); the poisoned one's signed `DENY` was refused (9WAKGzuMq6EGoh3rdUJj9Z71SdYr91tJRiJ9C6YVa7A6); the owner withdrew 0.01 wNEAR (FyxjJGT4UkigDEmV4Bq4k9TBpi63zrTqaaE2s9VoYUZE) and a non-owner was refused.
- Tests: 51 in `contract/wallet` (with `new_with`), 5 in `contract/factory`; disabling any of the factory's six guards fails a test.
- A new wallet version means a new factory; existing wallets keep their code.
