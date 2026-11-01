# Decisions

Architecture and product decision records (ADRs). One file per decision, named `YYYY-MM-DD-short-title.md`, **never edited after the fact**: if a decision changes, write a new record that supersedes the old one and link both ways.

[`interface-spec.md`](../interface-spec.md) describes the shared shapes and changes over time. Records here describe *why* something was chosen on a given day and who chose it, so a reader (human or AI judge) can tell a deliberate choice from an accident. They replace the `DECISIONS.md` the build plan mentions.

## Format

```
# Title
Date · Decided by · Status (accepted | superseded by <file>)

## Context
What was true, what was being weighed.

## Decision
One paragraph, or a short list.

## Consequences
What this makes easier, what it rules out, what to watch.
```

## Index

| Date | Decision | By |
| --- | --- | --- |
| 2026-11-01 | [Build Intented, with Sealed-lite as the fallback, decided by four kill tests on Day 1](./2026-11-01-build-intented-with-sealed-lite-fallback.md) | Furqaan, William |
| 2026-11-01 | [One repo, one folder per part, each owned by one person; decisions as dated records](./2026-11-01-repo-layout-and-ownership.md) | Furqaan, William |
| 2026-11-01 | [The trust model: attestation checked off-chain, signer allowlisted on-chain, the contract's caps as the backstop](./2026-11-01-signed-verdict-trust-model.md) | Furqaan, William |
| 2026-11-01 | [The firewall core's interface is the seam: a stub until Day 6, the real core after](./2026-11-01-firewall-core-interface-is-the-seam.md) | Furqaan, William |
| 2026-11-01 | [KT1 and KT2 pass: NEAR AI signatures verify on-chain, no relayer](./2026-11-01-kt1-kt2-pass.md) | Furqaan |
| 2026-11-01 | [The signed text includes the model id; signatures are ECDSA through env::ecrecover](./2026-11-01-signed-text-includes-model-id.md) (proposed, awaiting William) | Furqaan |
| 2026-11-01 | [firewall-core: TypeScript on Node with pnpm, tsx, vitest and ethers v6](./2026-11-01-firewall-core-toolchain.md) | Furqaan |
| 2026-11-01 | [Wallet caps count token amounts; the daily window is the UTC day; the allowlist covers receiver contracts](./2026-11-01-wallet-caps-window-allowlist.md) | Furqaan |

## Not decided yet

| Question | Settled by | Owner |
| --- | --- | --- |
| Model: Qwen3.8-27B or GLM-5.3-flash. Both pass KT1; GLM is faster in the smoke test ([KT1/KT2 record](./2026-11-01-kt1-kt2-pass.md)) | KT3, 1 November (retest 2 November) | Furqaan, William |
| API framework (Hono or Express) and host (Railway or Render) | William's pick | William |
| Optional OutLayer integration | Discord question 3 | Furqaan |
