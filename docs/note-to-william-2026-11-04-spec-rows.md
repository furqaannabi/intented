# Note to William: the spec rows waiting on your yes

From Furqaan, 4 November; updated the same day with the bounded proposals ([record](./decisions/2026-11-04-bounded-proposals-and-mainnet-key.md)). Proposed spec text, not yet in [`interface-spec.md`](./interface-spec.md). Built and on testnet already, from these records: [the factory](./decisions/2026-11-04-wallet-factory-on-testnet.md), [the factory as built](./decisions/2026-11-04-factory-as-built.md), and the `propose` size limits (commit `a137a17`). On your yes I copy it in with an acceptance record.

## 1. Contract methods table: new rows

| Method | Who may call |
| --- | --- |
| `new_with(owner_id, agent_id, model_id, setup)` | init, once (the factory's one-call setup) |
| `withdraw(token_id?, amount)` | owner |
| `add_agent_key(public_key, allowance)` · `remove_agent_key(public_key)` | owner |
| `prune(proposal_ids)` | anyone for executed, failed or expired-pending proposals; the owner also for any pending one; at most 64 ids |

```
setup = { signer, prompt_hash, mandate_hash?, token_id, token: { symbol, decimals, caps }, near_caps }
```

- `new_with` applies the same checks as the owner's setters, and allowlists `token_id` as a receiver.
- `withdraw` sends a token (`ft_transfer`) or, with no `token_id`, NEAR above what the wallet's storage needs, to the owner. Unjudged; works while frozen.
- `add_agent_key` adds a function-call key on the wallet's own account, scoped to `propose` and `execute` on it, with a positive allowance. Never a full-access key.

## 2. `propose`: one sentence after "`propose` requires `sha256(args_json) == args_sha256`"

> It also refuses `args_json` over 2048 bytes, a `method` over 64 characters, an action whose `receiver_id` is the wallet itself, an `expiry_ms` more than an hour ahead, and a proposal while 32 are pending. A successful `execute` frees its slot.

## 3. New section: Wallet factory (Furqaan, testnet only)

| Method | Who may call |
| --- | --- |
| `new(code)` | init, once; the code for new wallets changes only by `set_code` |
| `create(name, model_id, setup, agent_key?, agent_allowance?) -> Promise` | anyone, with a deposit of at least `get_min_deposit()` |
| `set_code(code)` | the factory account itself; wallets already made keep their code |
| `get_code_hash()` · `get_min_deposit()` | anyone (views) |

`create` makes `<name>.<factory>` in one batch: create the account, transfer the deposit, deploy the stored code, call `new_with` with the caller as owner and the wallet as its own agent, and, if `agent_key` is given, add it scoped to `propose` and `execute`. It adds no full-access key. If the batch fails, the deposit is refunded to the caller. `get_code_hash()` is base58(sha256(code)), the form NEAR shows as an account's `code_hash`.

## 4. Revision row

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-0X | Furqaan, William | `propose`'s size limits and self-call refusal; `new_with`, `withdraw`, `add_agent_key`, `remove_agent_key`; the testnet wallet factory. Records: [factory](./decisions/2026-11-04-wallet-factory-on-testnet.md), [as built](./decisions/2026-11-04-factory-as-built.md), [accepted](./decisions/2026-11-0X-accept-wallet-factory.md) |
