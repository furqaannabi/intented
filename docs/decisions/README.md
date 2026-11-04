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
| 2026-11-01 | [The signed text includes the model id; signatures are ECDSA through env::ecrecover](./2026-11-01-signed-text-includes-model-id.md) (accepted by [this record](./2026-11-01-accept-model-id-signed-text.md)) | Furqaan |
| 2026-11-01 | [firewall-core: TypeScript on Node with pnpm, tsx, vitest and ethers v6](./2026-11-01-firewall-core-toolchain.md) | Furqaan |
| 2026-11-01 | [Wallet caps count token amounts; the daily window is the UTC day; the allowlist covers receiver contracts](./2026-11-01-wallet-caps-window-allowlist.md) (owner setters accepted by [this record](./2026-11-01-accept-wallet-seam-amount-and-updated-at.md)) | Furqaan |
| 2026-11-01 | [execute checks what the signed request asked, not only the signed verdict](./2026-11-01-execute-checks-the-signed-request.md) (accepted by [this record](./2026-11-01-accept-wallet-seam-amount-and-updated-at.md)) | Furqaan |
| 2026-11-01 | [The wallet executes a real NEAR AI ALLOW on testnet and refuses a real DENY](./2026-11-01-first-testnet-execution.md) | Furqaan |
| 2026-11-01 | [The poisoned-paywall refusal is on-chain, with a transaction hash](./2026-11-01-attack-refusal-on-chain.md) | Furqaan |
| 2026-11-01 | [The attestation checker ports NEAR's verifier and fails closed](./2026-11-01-attestation-checker.md) | Furqaan |
| 2026-11-01 | [The firewall core's seam is real; on-chain calls use near-api-js 7.3.1](./2026-11-01-firewall-core-seam-and-near-api-js.md) (factories accepted by [this record](./2026-11-01-accept-wallet-seam-amount-and-updated-at.md)) | Furqaan |
| 2026-11-01 | [Go: Intented goes ahead on Qwen3.8-27B](./2026-11-01-go-intented-on-qwen.md) | Furqaan, William |
| 2026-11-01 | [Accepted: the signed text includes the model id; signatures are ECDSA through env::ecrecover](./2026-11-01-accept-model-id-signed-text.md) | Furqaan, William |
| 2026-11-01 | [The model sees token amounts already converted, and the wallet checks the conversion](./2026-11-01-model-sees-converted-amount.md) (accepted by [this record](./2026-11-01-accept-wallet-seam-amount-and-updated-at.md)) | Furqaan |
| 2026-11-01 | [Accepted: execute checks the signed request, the seam as factories, converted amounts, the owner setters and updated_at](./2026-11-01-accept-wallet-seam-amount-and-updated-at.md) | Furqaan, William |
| 2026-11-01 | [api: Hono on Node, with node:sqlite for storage](./2026-11-01-api-hono-and-node-sqlite.md) | William |
| 2026-11-01 | [api: proposals run in the background, every verdict goes on-chain, and failed means no money moved](./2026-11-01-api-pipeline-behaviour.md) (`updated_at` accepted by [this record](./2026-11-01-accept-wallet-seam-amount-and-updated-at.md)) | William |
| 2026-11-01 | [The demo agent is scripted; the mock x402 paywall checks payment on-chain](./2026-11-01-demo-agent-and-paywall.md) | William |
| 2026-11-01 | [The red-team endpoint serves one committed run, in the spec's shape, and the page hides figures it can't fetch](./2026-11-01-redteam-published-run.md) (page rows superseded by [this record](./2026-11-01-no-redteam-figures-on-the-page.md)) | William |
| 2026-11-01 | [The landing page doesn't show the red-team figures](./2026-11-01-no-redteam-figures-on-the-page.md) | William |
| 2026-11-01 | [The rules page: everyone sees the live mandate, the owner edits it with their own NEAR wallet](./2026-11-01-mandate-page.md) | William |
| 2026-11-02 | [make redteam runs every case through judge(), and a NEAR AI outage stops the run](./2026-11-02-make-redteam-through-judge.md) | William |
| 2026-11-03 | [Accepted: look up a mandate's text by its hash, and say the active mandate is public](./2026-11-03-accept-mandate-lookup.md) | Furqaan, William |
| 2026-11-03 | [Accepted: the cross-chain payment through 1Click, with the real recipient in front of the judge](./2026-11-03-cross-chain-through-1click.md) | Furqaan, William |
| 2026-11-03 | [execute verifies 1Click's signed quote, so the deposit address is not the API's word](./2026-11-03-execute-verifies-the-1click-quote.md) (proposed; accepted below) | Furqaan |
| 2026-11-03 | [Accepted: execute verifies 1Click's signed quote, over the fields 1Click actually signs](./2026-11-03-accept-signed-1click-quote.md) | Furqaan, William |
| 2026-11-04 | [An optional Idempotency-Key on POST /api/propose, so a retried cross-chain payment is sent once](./2026-11-04-idempotency-key-on-propose.md) (proposed; accepted below) | William |
| 2026-11-04 | [Accepted: an optional Idempotency-Key on POST /api/propose, with 409 and 429 in the spec](./2026-11-04-accept-idempotency-key.md) | Furqaan, William |
| 2026-11-04 | [A wallet factory on testnet: one signed create, no full-access key, the agent's key added by the wallet](./2026-11-04-wallet-factory-on-testnet.md) (proposed, awaiting William) | Furqaan |
| 2026-11-04 | [The wallet factory as built on testnet: stored code, the wallet as its own agent](./2026-11-04-factory-as-built.md) (proposed, awaiting William) | Furqaan |

## Not decided yet

| Question | Settled by | Owner |
| --- | --- | --- |
| API host (Railway or Render) | William's pick, by deployment on Day 9 | William |
| Optional OutLayer integration | Discord question 3 | Furqaan |
