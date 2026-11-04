# A wallet factory on testnet: one signed create, no full-access key, the agent's key added by the wallet

2026-11-04 · Decided by Furqaan · Status: proposed (new owner methods, a new contract, and a change to who may call `propose` and `execute`, so it needs William's agreement; it follows his suggestion of 4 November)

## Context

A new owner can today only get a wallet by running `contract/wallet/scripts/deploy-wallet.sh`, which needs near-cli, cargo-near, pnpm and keys in a keychain. William proposed a factory and a "Create your wallet" page, so an owner signs once in their own NEAR wallet and nothing runs in a terminal. near-sdk 5.30 supports global contracts (`deploy_global_contract`, `use_global_contract` by code hash) and a contract adding or deleting keys on its own account.

## Decision

- **Testnet only for the hackathon.** Our mainnet wallet is deployed on 11 November with the script; a mainnet factory is on the roadmap. The newest contract code stays away from the mainnet deploy.
- **The wallet code is a global contract, by code hash.** Deployed once; anyone can check which code every factory wallet runs. A wallet costs its account's storage, not 305 KB of code.
- **The factory** has one public method that, in one batch, creates `<name>.<factory>` with the attached NEAR, uses the global code by hash, and calls `new` with the owner (the caller), the model, the signer and the owner's settings. It adds **no full-access key**: nobody, the owner included, can redeploy a factory wallet.
- **The owner sets the signer in the create call.** The page prefills it from the published attestation report in `docs/attestations/` and links it; the factory hard-codes no signer. When NEAR AI rotates its key, each owner registers the new one.
- **The agent's key is added by the wallet to itself.** Owner-only `add_agent_key(public_key, allowance)` adds a function-call key on the wallet account scoped to `propose` and `execute`; `remove_agent_key(public_key)` deletes it. The agent needs no account. `propose` and `execute` accept the wallet itself as caller as well as `agent_id`; gas comes from the wallet's balance, up to the key's allowance.
- **The owner can withdraw.** Owner-only `withdraw` sends NEAR, or a token the wallet holds, to the owner. Without a full-access key it is the only way out besides a judged `execute`. The agent cannot call it: its key is scoped to `propose` and `execute`.

## Consequences

- No terminal for a new owner on testnet; the web app still never holds a key, since the owner signs every call in their own wallet.
- A factory wallet can never be upgraded. A bug means the owner withdraws and creates a new wallet.
- The owner is trusted with their own wallet: `withdraw` lets them take funds out unjudged, which is their right, and is not a path for the agent.
- About two days of contract work, test-first, before the 7 November integration day.
- The README states the factory runs on testnet only.
