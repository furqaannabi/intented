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
| 2026-11-04 | [Proposals are bounded and prunable; the mainnet wallet's full-access key is deleted after setup](./2026-11-04-bounded-proposals-and-mainnet-key.md) (proposed, awaiting William) | Furqaan |
| 2026-11-04 | [The API judges any factory wallet's proposals, and the agent sends its own transactions](./2026-11-04-verdict-for-any-wallet.md) (proposed; accepted below) | William |
| 2026-11-04 | [Accepted: POST /api/verdict judges any factory wallet's proposals, and the agent sends its own transactions](./2026-11-04-accept-verdict-for-any-wallet.md) | Furqaan, William |
| 2026-11-05 | [The demo agent holds its own key, and the API holds none: a quote step for 1Click, POST /api/propose removed](./2026-11-05-demo-agent-holds-its-own-key.md) (proposed; accepted below) | William |
| 2026-11-05 | [Accepted: the demo agent holds its own key and the API holds none, with a cap on quotes across all wallets](./2026-11-05-accept-demo-agent-own-key.md) | Furqaan, William |
| 2026-11-05 | [POST /api/quote doesn't check the cross-chain recipient list; the model and the contract do](./2026-11-05-quote-skips-recipient-list.md) | Furqaan, William |
| 2026-11-05 | [A refusal's receipt links the wallet's refused execute](./2026-11-05-receipts-link-refused-execute.md) | William |
| 2026-11-06 | [No OutLayer integration this hackathon; Discord question 3 closed as not needed](./2026-11-06-cut-outlayer.md) | Furqaan |
| 2026-11-06 | [Accepted: the wallet factory, bounded proposals and the wallet's new methods enter the interface spec](./2026-11-06-accept-wallet-factory-and-bounded-proposals.md) | Furqaan, William |
| 2026-11-06 | [The full protocol goes to mainnet, and factory wallets have cap ceilings](./2026-11-06-full-protocol-on-mainnet.md) (superseded the same day by the next record) | Furqaan, William |
| 2026-11-06 | [Mainnet is one wallet; the product stays on testnet](./2026-11-06-one-mainnet-wallet.md) | Furqaan, William |
| 2026-11-06 | [The mainnet site is a second build of the web app: the network is a build setting](./2026-11-06-minimal-mainnet-with-a-network-switch.md) | William |
| 2026-11-06 | [Intented as an MCP server and a skill, in a new mcp/ folder owned by Furqaan](./2026-11-06-mcp-folder.md) (the folder became `client/`: next record) | Furqaan, William |
| 2026-11-07 | [One npm package, `intented`: the CLI, the library and the MCP server; the API hosted on EC2](./2026-11-07-npm-package-intented.md) (proposed) | Furqaan |
| 2026-11-06 | [The API caps verdicts across all wallets in any 24 hours, set by VERDICT_DAILY_CAP](./2026-11-06-daily-verdict-cap.md) | William |
| 2026-11-07 | [A docs site for developers in `docs-site/`, on Mintlify](./2026-11-07-docs-site-on-mintlify.md) | Furqaan, William |
| 2026-11-09 | [William runs the mainnet runbook](./2026-11-09-william-runs-the-mainnet-runbook.md) | Furqaan, William |
| 2026-11-09 | [The mainnet wallet is `intented-wallet.near`, and keeps its full-access key until it's taken down](./2026-11-09-mainnet-wallet-intented-wallet-near.md) | William |
| 2026-11-09 | [On mainnet: one real 2 USDC payment to Base through 1Click, and one refused attack](./2026-11-09-mainnet.md) | William |

## Not decided yet

| Question | Settled by | Owner |
| --- | --- | --- |
| API host (Railway or Render) | William's pick, by deployment on Day 9 | William |
