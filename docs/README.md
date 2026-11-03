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

William's rows and the cross-chain row are as of 3 November; Furqaan's are as of 1 November.

| Piece | Path | Owner | State |
| --- | --- | --- | --- |
| KT1 Signed verdict | `firewall-core/scripts/kt1.ts` | Furqaan | **Passed** ([record](./decisions/2026-11-01-kt1-kt2-pass.md)) |
| KT2 On-chain verify | `contract/kt2-verify/` | Furqaan | **Passed** on testnet ([record](./decisions/2026-11-01-kt1-kt2-pass.md)) |
| KT3 Model quality | `redteam/` | William (cases, runner), Furqaan (prompt) | **Passed.** Qwen3.8-27B: 20/20 attacks denied, 0/20 benign denied, 4.57 s median ([record](./decisions/2026-11-01-go-intented-on-qwen.md)). With 13 wNEAR cases added (53 in all): 27/27 attacks denied, 0/26 benign denied, 4.59 s median; an earlier run the same day was correct on every case but missed the latency bar at 5.30 s |
| KT4 1Click settlement | `api/scripts/kt4.ts` | William | Dry quote works: 2 USDC on NEAR quotes to 1.997 USDC on Base in about 22 s. Not passed: one real $2 payment waits on both owners |
| Wallet contract | `contract/wallet/` | Furqaan | `propose` and `execute` with every check, including the converted amount; 31 tests; deployed to `intented-wallet.testnet` on Qwen; an allowed action executed and a real DENY refused ([record](./decisions/2026-11-01-go-intented-on-qwen.md)) |
| Firewall core and attestation checker | `firewall-core/` | Furqaan | Done: `judge`, `proposeOnChain`, `executeOnChain` (the seam), canonical encoder, prompt, verdict parser, attestation checker (`pnpm attest`), converted token amounts; 126 tests; both demo paths run through it on testnet |
| API, storage and 1Click module | `api/` | William | Hono and node:sqlite ([record](./decisions/2026-11-01-api-hono-and-node-sqlite.md)); every endpoint in the spec, `/api/redteam/latest` included, with the background pipeline ([record](./decisions/2026-11-01-api-pipeline-behaviour.md)). Checks the wallet's mandate, model and prompt hash before judging; settles from the wallet's record after a crash. On `intented-wallet.testnet` a real ALLOW executes and a real DENY ends in the wallet's refused `execute` (hashes in the agent row). The cross-chain propose is built (exact-output quote, transfer to the deposit address, the `cross_chain` field, deposit tracking) and answers `501` until the firewall core's `judge()` takes the field. 48 tests |
| Web app | `web/` | William | Landing page, Activity (a live feed with a receipt per payment: the signed reason, signer, signature, attestation link and transactions) and Rules (the active mandate, checked against the wallet's hash; the owner signs `set_mandate` with their own wallet), in the Carbon theme. Activity shows payments to Base with the delivery status, and every testnet delivery as simulated |
| Demo agent and mock x402 paywall | `agent/` | William | Scripted agent and a paywall that checks payment itself ([record](./decisions/2026-11-01-demo-agent-and-paywall.md)). Both NEAR paths run end to end on `intented-wallet.testnet`: the honest one executes and the vendor is paid 0.001 wNEAR (`C8P7yHvwT6e6C5LZLgXQ4uXDJwyoCDGX6Y7Vq5uvbtHH`, 20 s); the poisoned one ends in a `DENY` and the wallet's refusal, "verdict is not ALLOW", with no transfer (`FvsDHLYMAXuAuTSUyDzhUzG3Z9kPnzv4FD9MxDj88jxm`, 15 s). Added: Base routes on the paywall, a testnet stand-in for 1Click with simulated delivery, and the agent's Base path. 29 tests |
| Red-team fixtures and runner | `redteam/` | William | Published run in `redteam/latest.json`: 53 cases × 3 runs on Qwen3.8-27B, 27/27 attacks blocked, 0/26 honest payments stopped, 5.5 s median. 16 cross-chain cases (8 attacks, 8 honest) are written; the runner refuses to score them until `judge()` sends the `cross_chain` field. 9 tests |
| Cross-chain to Base through 1Click | `api/`, `agent/`, `web/`, `redteam/`, `firewall-core/`, `contract/` | Both | Design accepted ([record](./decisions/2026-11-03-cross-chain-through-1click.md)). William's side is built. Waiting on: Furqaan's `judge()` field, prompt and contract checks ([checklist](./note-to-furqaan-2026-11-03-cross-chain-checklist.md)); the testnet deposit account `intented-1click.testnet`, created and registered on wrap.testnet; the wallet's mandate naming the vendor's Base address. Not yet tested end to end |

## Key dates

| Milestone | When |
| --- | --- |
| Interface spec locked; kill tests | 1 November (go/no-go that evening) |
| The real firewall core replaces the stub | 6 November |
| Integration day: the full flow on testnet in the UI | 7 November |
| Feature-complete on testnet | 10 November |
| Mainnet deploy; one allowed and one blocked mainnet transaction | 11 November |
| Feature freeze; fresh-clone test | 13 November |
| Submit (irreversible, once) | 14 November, by 20:00 IST |

## Open Discord questions

From plan §8. Strike each one here when answered, and record any decision it settles in `decisions/`.

| # | Question | Asks |
| --- | --- | --- |
| 1 | Do proprietary models on NEAR AI Cloud return TEE signatures? How long are signatures kept, how often do signing addresses rotate? | Furqaan |
| ~~2~~ | ~~Hackathon credits for NEAR AI Cloud? Payable in crypto?~~ Answered by the hackathon brief: $10 free by joining NEAR Builders; credits are payable by crypto or card | Furqaan |
| 3 | An API for OutLayer multisig approvals, or a co-signer hook? Can `request_execution` call out over HTTPS? | Furqaan |
| 4 | After the 7 October Notify removal, does `ft_withdraw`/`mt_withdraw` with `msg` still trigger `ft_on_transfer`? Can 1Click deliver to a contract with a custom `msg`? | Furqaan |
| 5 | Partner JWT approval time, a hackathon fee waiver, the 9 September $1,000 minimum | William |
| 6 | Confidentiality "basic" vs "advanced"; contracts as confidential recipients; a view-key API | Furqaan |
| 8 | An official successor to Shade Agents? | Furqaan |
| 9 | Prizes in more than one track; grand prize plus a track prize | William |
| 10 | Pre-1 November experiments and mockups; do AI judges run the code; does mainnet count for more | William |
| 11 | KYC or sanctions checks for India-based payouts; the NEAR/USD rate used | William |
