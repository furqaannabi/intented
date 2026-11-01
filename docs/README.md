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

| Piece | Path | Owner | State (2026-11-01) |
| --- | --- | --- | --- |
| KT1 Signed verdict | `firewall-core/scripts/kt1.ts` | Furqaan | **Passed** ([record](./decisions/2026-11-01-kt1-kt2-pass.md)) |
| KT2 On-chain verify | `contract/kt2-verify/` | Furqaan | **Passed** on testnet ([record](./decisions/2026-11-01-kt1-kt2-pass.md)) |
| KT3 Model quality | `redteam/` | William (cases, runner), Furqaan (prompt) | Prompt ready in `firewall-core/src/prompt.ts`; cases and runner not started |
| KT4 1Click settlement | — | William | Not started |
| Wallet contract | `contract/wallet/` | Furqaan | `propose` and `execute` with every check, 29 tests; deployed to `wallet.intented-owner.testnet`; first allowed action executed and a real DENY refused ([record](./decisions/2026-11-01-first-testnet-execution.md)) |
| Firewall core and attestation checker | `firewall-core/` | Furqaan | Done: `judge`, `proposeOnChain`, `executeOnChain` (the seam), canonical encoder, prompt, verdict parser, attestation checker (`pnpm attest`); 107 tests; both demo paths run through it on testnet |
| API, storage and 1Click module | `api/` | William | Not started |
| Web app | `web/` | William | Scaffolded; placeholder live at https://intented-near.vercel.app/ |
| Demo agent and mock x402 paywall | `agent/` | William | Not started |
| Red-team fixtures and runner | `redteam/` | William | Not started |

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
