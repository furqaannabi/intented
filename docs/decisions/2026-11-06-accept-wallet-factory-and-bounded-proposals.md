# Accepted: the wallet factory, bounded proposals and the wallet's new methods enter the interface spec

2026-11-06 · Decided by Furqaan, William · Status: accepted

## Context

Furqaan built the testnet wallet factory ([proposed](./2026-11-04-wallet-factory-on-testnet.md), [as built](./2026-11-04-factory-as-built.md)), bounded the wallet's proposals after William pointed out the storage gap ([record](./2026-11-04-bounded-proposals-and-mainnet-key.md)), and added `get_wallets` at William's request. All of it was live on testnet from 4 November, but the spec rows waited on William's agreement in [the note](../note-to-william-2026-11-04-spec-rows.md).

William's answer, 6 November:

> Yes: add the factory and bounded-proposals rows to the interface spec, with the acceptance record.

## Decision

The rows go into [the interface spec](../interface-spec.md) as the note proposed:

- The contract methods table gains `new_with`, `withdraw`, `add_agent_key`, `remove_agent_key` and `prune`, with the `setup` shape and what each does.
- `propose` refuses `args_json` over 2048 bytes, a `method` over 64 characters, an action that calls the wallet itself, an `expiry_ms` more than an hour ahead, and a 33rd pending proposal. A successful `execute` frees its slot.
- A new section, the wallet factory (testnet only): `new`, `create`, `set_code`, `get_code_hash`, `get_min_deposit` and `get_wallets`.

## Consequences

- The spec matches what runs on testnet. Nothing in the code changes.
- The factory section says "testnet only". If it goes to mainnet, that is a new decision with its own record and spec revision.
