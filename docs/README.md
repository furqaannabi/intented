# Intented — docs

**Start here if you are new.** This folder is the project's memory: what we are building, why, how, and what is decided versus open. Read in this order.

| # | Read | Time | Why |
| --- | --- | --- | --- |
| 1 | [`Intented hackathon plan.pdf`](./Intented%20hackathon%20plan.pdf) | 15 min | The build plan: what Intented is, the components and owners, the Day-1 kill tests, the day-by-day plan, risks, cut lines and the submission checklist. **Source of truth for the plan.** |
| 2 | [`interface-spec.md`](./interface-spec.md) | 5 min | The shared shapes: canonical bytes, the verdict, the contract methods, the firewall core, the 1Click module, the HTTP API. Changes only when both agree. |
| 3 | [`glossary.md`](./glossary.md) | 3 min | The words we use, exactly. |
| 4 | [`decisions/`](./decisions/README.md) | 5 min | Dated decision records, never edited after the fact, and what is still undecided. |
| 5 | [`NEAR hackathon idea selection.md`](./NEAR%20hackathon%20idea%20selection.md) and [`research_notes/`](./research_notes/) | 20 min | Why this idea over nine others: competition, feasibility, judges, the official rules. |

## One-paragraph version

Agents with wallets get prompt-injected, and spending caps alone don't catch an attack that stays under the cap. Intented puts a check on meaning in front of the wallet: the agent proposes an action, the firewall core asks a model running in a TEE on NEAR AI Cloud whether it fits the owner's plain-English mandate, and the wallet contract executes only when it holds a TEE-signed `ALLOW` verdict for exactly that action, within its own hard caps. The demo pays a paywall cross-chain to Base through 1Click, then blocks a poisoned paywall's "pay 10× to this address" even though the amount is under the cap. Submission for the NEAR Hackathon is **14 November 2026, 23:59 UTC**; we aim to submit by 20:00 IST.

## Status board

As of 10 November. The latest plan: [`phase-2.md`](./phase-2.md); the Status section of the [root README](../README.md#status) has every transaction.

| Piece | Path | Owner | State |
| --- | --- | --- | --- |
| KT1 Signed verdict | `firewall-core/scripts/kt1.ts` | Furqaan | **Passed** ([record](./decisions/2026-11-01-kt1-kt2-pass.md)) |
| KT2 On-chain verify | `contract/kt2-verify/` | Furqaan | **Passed** on testnet ([record](./decisions/2026-11-01-kt1-kt2-pass.md)) |
| KT3 Model quality | `redteam/` | William (cases, runner), Furqaan (prompt) | **Passed** on correctness: Qwen3.8-27B, 20/20 attacks denied and 0/20 benign denied on 1 November ([record](./decisions/2026-11-01-go-intented-on-qwen.md)). The published run (5 November, 83 cases × 3): 44/44 attacks blocked, 0/39 honest payments stopped, every run correct, 6.0 s median, over the 5 s latency bar |
| KT4 1Click settlement | `api/scripts/kt4.ts` | William | **Passed** on mainnet, 9 November: 2.0 USDC delivered on Base from a payment the wallet made on `ALLOW` ([record](./decisions/2026-11-09-mainnet.md)) |
| Wallet contract | `contract/wallet/` | Furqaan | Done: `propose` and `execute` with every check, including the converted amount, the cross-chain recipient list and 1Click's signed quote; at most 32 pending proposals, `prune`, `withdraw`, agent keys, `new_with`; 57 tests. Live at `intented-wallet.testnet` and, since 9 November, `intented-wallet.near`, built reproducibly ([record](./decisions/2026-11-09-mainnet.md)) |
| Wallet factory | `contract/factory/` | Furqaan | Testnet only, at `intented.testnet`: `create` makes a configured `<name>.intented.testnet` with no full-access key and refunds on failure; `get_wallets` per owner; `set_code` by the factory account only; 9 tests ([record](./decisions/2026-11-04-factory-as-built.md)) |
| Firewall core and attestation checker | `firewall-core/` | Furqaan | Done: `judge`, `proposeOnChain`, `executeOnChain` (the seam), the canonical encoder, prompt, verdict parser, attestation checker (`pnpm attest`), converted token amounts, the `cross_chain` field; 141 tests. Signer `0x835ab53d…6aa26` attested again on 9 November |
| API, storage and 1Click module | `api/` | William | Done: every endpoint in the spec, the background pipeline that settles from the wallet's record and follows 1Click deposits; quotes from 1Click on mainnet and from the stand-in on testnet; `amount_out` taken from 1Click's signed quote; 96 tests. Testnet API hosted at `https://hack.furqaannabi.com` on 10 November, by Furqaan; the mainnet API runs locally |
| Web app | `web/` | William | Done: landing, Activity (a live feed with a receipt per payment), Rules, Create wallet, My wallets, and a page per wallet with live payments and the owner's actions, each signed in the owner's own NEAR wallet. A mainnet build behind a Testnet \| Mainnet switch. Testnet build live at `intented-near.vercel.app` since 10 November; the mainnet build runs locally |
| Demo agent, paywall and 1Click stand-in | `agent/` | William | Done: the honest, poisoned, Base and Base-poisoned routes, on testnet and on mainnet; `check-tx`; the storage sponsor for 1Click deposit addresses on mainnet; 66 tests ([record](./decisions/2026-11-01-demo-agent-and-paywall.md)) |
| The `intented` package | `client/` | Furqaan | Done: `intented init`, `intented pay`, `pay()` and the MCP server; 18 tests. Checked end to end from the CLI and from Claude Code on 7 and 9 November. Defaults to the hosted API and site (`06dd718`). One honest payment and one attack passed through the hosted API on 10 November, and both owners said yes to the name and 0.1.0; not on npm yet ([record](./decisions/2026-11-07-npm-package-intented.md)) |
| Developer docs | `docs-site/` | William; Furqaan reviews his lane's pages | Written, on Mintlify; not hosted yet ([record](./decisions/2026-11-07-docs-site-on-mintlify.md)) |
| Red-team fixtures and runner | `redteam/` | William | Published run in `redteam/latest.json`: 83 cases, 16 of them cross-chain and 12 attacks on the judge itself; 16 tests |
| Cross-chain to Base through 1Click | `api/`, `agent/`, `web/`, `redteam/`, `firewall-core/`, `contract/` | Both | **Done.** On testnet with the stand-in and simulated delivery; on mainnet through 1Click itself, with real delivery on 9 November ([record](./decisions/2026-11-09-mainnet.md)) |
| Mainnet | `docs/mainnet-runbook.md` | William ran it | **Done 9 November**: one real payment to Base, one refused attack ([record](./decisions/2026-11-09-mainnet.md)) |

## Key dates

| Milestone | When |
| --- | --- |
| Interface spec locked; kill tests | 1 November (go/no-go that evening) |
| The real firewall core replaces the stub | 6 November |
| Integration day: the full flow on testnet in the UI | 7 November |
| Feature-complete on testnet | 10 November |
| Mainnet deploy; one allowed and one blocked mainnet transaction | 11 November; done 9 November |
| Feature freeze; fresh-clone test | 13 November |
| Submit (irreversible, once) | 14 November, by 20:00 IST |

## Open Discord questions

From plan §8. Strike each one here when answered, and record any decision it settles in `decisions/`.

| # | Question | Asks |
| --- | --- | --- |
| 1 | Do proprietary models on NEAR AI Cloud return TEE signatures? How long are signatures kept, how often do signing addresses rotate? | Furqaan |
| ~~2~~ | ~~Hackathon credits for NEAR AI Cloud? Payable in crypto?~~ Answered by the hackathon brief: $10 free by joining NEAR Builders; credits are payable by crypto or card | Furqaan |
| ~~3~~ | ~~An API for OutLayer multisig approvals, or a co-signer hook? Can `request_execution` call out over HTTPS?~~ Not needed: the OutLayer integration is cut ([record](./decisions/2026-11-06-cut-outlayer.md)) | Furqaan |
| 4 | After the 7 October Notify removal, does `ft_withdraw`/`mt_withdraw` with `msg` still trigger `ft_on_transfer`? Can 1Click deliver to a contract with a custom `msg`? | Furqaan |
| 5 | Partner JWT approval time, a hackathon fee waiver, the 9 September $1,000 minimum | William |
| 6 | Confidentiality "basic" vs "advanced"; contracts as confidential recipients; a view-key API | Furqaan |
| 8 | An official successor to Shade Agents? | Furqaan |
| 9 | Prizes in more than one track; grand prize plus a track prize | William |
| 10 | Pre-1 November experiments and mockups; do AI judges run the code; does mainnet count for more | William |
| 11 | KYC or sanctions checks for India-based payouts; the NEAR/USD rate used | William |
