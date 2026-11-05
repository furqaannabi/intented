# A refusal's receipt links the wallet's refused execute

2026-11-05 · Decided by William (Furqaan left changes in William's lane to him, 5 November) · Status: accepted

## Context

On a `DENY` the agent still sends `execute`, and the wallet refuses it on chain ("verdict is not ALLOW"). That refused transaction is the proof a refusal happened. But `POST /api/executed` took only a successful `execute`, and the agent reported only an `ALLOW`, so every refusal's receipt showed "Transaction —". The design review on 5 November flagged it: the first refusal a judge opens had nothing to check on chain.

## Decision

- `POST /api/executed` also takes a refused `execute` when the stored verdict is `DENY`. It still must be the wallet's agent calling that wallet's `execute` with that `proposal_id`.
- A failed `execute` on an `ALLOW` is still `409`: that proposal may yet execute, and its hash may be a 1Click deposit.
- The agent reports its `execute` after a `DENY` as well as after a paid `ALLOW`.

## Consequences

- A refusal's receipt links its refused transaction on nearblocks.
- Safe for 1Click: a `DENY` never reaches `executed`, so its hash is never submitted as a deposit.
