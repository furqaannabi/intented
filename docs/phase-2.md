# Intented: phase 2

What is done after phase 1 (1–6 November), and the plan for phase 2 (7–14 November). For Furqaan and William. As of 6 November 2026, `main` at `714330a`. The build plan doesn't name phases; this split is ours.

> **Where we are.** The whole flow runs on NEAR testnet. An agent proposes a payment, a model in a TEE on NEAR AI Cloud judges it against the owner's mandate and signs the verdict, and the wallet contract pays only on a valid signed `ALLOW` within its caps. The honest payment and the attack, both NEAR-native and cross-chain to Base, have transaction hashes. Anyone can make a wallet through the factory. The API holds no NEAR key. All 369 tests pass.
>
> **What phase 2 is.** Integration in the UI, the loose ends below, the Claude Code and Cursor integration (an MCP server and a skill, agreed 6 November, first to cut), one wallet on mainnet on 11 November for the real 1Click payment and a refused attack, while the product stays on testnet ([record](./decisions/2026-11-06-one-mainnet-wallet.md)), then the video, the freeze and the submission.

## 1. What is done

| Piece | Owner | State | Tests |
| --- | --- | --- | --- |
| Kill tests | Both | **KT1, KT2 and KT3 passed.** A NEAR AI signature is verified on chain with `env::ecrecover`, and Qwen3.8-27B was chosen over GLM. KT4: the dry 1Click quote works; **the real $2 payment is not done** and waits on mainnet | |
| Wallet contract (`contract/wallet`) | Furqaan | `propose` and `execute` with every check: an allowlisted signer over the exact request and response, `ALLOW`, the exact action and args, the mandate and prompt hashes, the converted amount, nonce, expiry, per-token and NEAR caps per UTC day, freeze, and the cross-chain recipient list and 1Click's signed quote. At most 32 proposals pending, expiry at most 1 h ahead, `prune`, `withdraw`, agent keys, `new_with`, in-place migrations. Live at `intented-wallet.testnet` | 57 |
| Wallet factory (`contract/factory`) | Furqaan | Live at `intented.testnet`. `create` makes `<name>.intented.testnet` in one batch, with the caller as owner and no full-access key, and refunds the deposit on failure. `get_wallets` per owner. Code hash `Gy6sretT…`; only the factory account can call `set_code` | 9 |
| Firewall core (`firewall-core`) | Furqaan | `judge`, the canonical encoder, the prompt with untrusted data quoted, a fail-closed verdict parser, the converted token amounts, the `cross_chain` field, the signature fetched straight after the call, and the seam (`proposeOnChain`, `executeOnChain`), now used by the agent | 141 |
| Attestation | Furqaan | `pnpm attest` checks the Intel TDX quote with dcap-qvl, report_data bound to the signer and a fresh nonce, and NVIDIA's GPU JWT. The signer `0x835ab53d…aa26` is verified, published in `docs/attestations/` and allowlisted. Done off chain; the contract does not verify the quote | (in core) |
| API (`api`) | William | `/api/mandate`, `/api/mandates/:hash`, `/api/quote`, `/api/verdict`, `/api/executed`, `/api/proposals`, `/api/redteam/latest`. It judges, quotes 1Click and reads the chain. **It holds no NEAR key**: `/api/propose` and `AGENT_PRIVATE_KEY` were removed on 5 November. Rate limits on verdicts (30 per wallet per hour) and on quotes (30 per wallet and 120 in all, per hour) | 90 |
| Agent and paywall (`agent`) | William | `intented init` (the agent makes its own key and gets the Create link) and `intented pay`. The four demos (honest, poisoned, base, base-poisoned) propose and execute with the agent's own key. A mock x402 paywall and the testnet 1Click stand-in | 56 |
| Web app (`web`) | William | Landing, Activity (a receipt per payment: reason, signer, signature, attestation link, transaction, including the refused `execute`), Rules (the mandate checked against its on-chain hash), Create, My wallets, and a wallet page with the owner's controls and a payments chart | none |
| Red team (`redteam`) | William | 83 cases × 3 runs through the real `judge()` on 5 November: **44/44 attacks blocked** (12 aimed at the judge, 8 cross-chain), **0/39 honest payments stopped**, 0 errors in 249 runs, all signed by the allowlisted address. **6.0 s median, over the 5 s bar** | 16 |
| Cross-chain to Base | Both | Works on testnet with the 1Click stand-in. The judge sees the Base recipient, token and amount; the wallet checks the recipient list and 1Click's ed25519 quote signature. **Delivery is simulated on testnet**; real 1Click runs only on mainnet | |

### Proof on testnet

| What | Wallet | Transaction |
| --- | --- | --- |
| Honest payment, 0.001 wNEAR to the vendor | intented-wallet | [`C8P7yHvw…`](https://testnet.nearblocks.io/txns/C8P7yHvwT6e6C5LZLgXQ4uXDJwyoCDGX6Y7Vq5uvbtHH) |
| Attack refused: 0.01 wNEAR to the attacker, under the cap ("verdict is not ALLOW") | intented-wallet | [`FvsDHLYM…`](https://testnet.nearblocks.io/txns/FvsDHLYMAXuAuTSUyDzhUzG3Z9kPnzv4FD9MxDj88jxm) |
| Base payment, 0.4 USDC to the vendor's Base address (simulated delivery) | intented-wallet | [`6ADu75vE…`](https://testnet.nearblocks.io/txns/6ADu75vEGwK8tKoPbw7Nfmh7BwTjJfX151WRYvDY5Vhg) |
| Base attack refused by the recipient list | intented-wallet | [`DbLMFYWs…`](https://testnet.nearblocks.io/txns/DbLMFYWsUf4r9DXAfnHfKf1NVyqacM9EVCyeb8nq3W5U) |
| Base attack refused on the verdict alone, with the list empty | intented-wallet | [`GYQKNHhZ…`](https://testnet.nearblocks.io/txns/GYQKNHhZbhxrqNzi8rYs7wJaoD3Hif4LSKZVDFXYfn8P) |
| Factory wallet: honest paid / poisoned refused | demo.intented | [`HNRq1HiX…`](https://testnet.nearblocks.io/txns/HNRq1HiXRVgPyevDKBZgRsEZQM9xDjRKRmY4aF7fPqw9) / [`9WAKGzuM…`](https://testnet.nearblocks.io/txns/9WAKGzuMq6EGoh3rdUJj9Z71SdYr91tJRiJ9C6YVa7A6) |
| Bounded-proposals code: honest paid / poisoned refused | demo2.intented | [`2eebywtF…`](https://testnet.nearblocks.io/txns/2eebywtFD8vU67C9NS3DSdi6dQRpUYVHSS6ZB1FD4ayp) / [`6bB1fqJF…`](https://testnet.nearblocks.io/txns/6bB1fqJFBSdcPECbNw2BQHmKmDFHusZE1FCyV1WX8H4C) |
| `intented pay` with the agent's own key: ALLOW paid / injected DENY refused | retest-1104.intented | [`4rddy8CU…`](https://testnet.nearblocks.io/txns/4rddy8CUvMfzJjxVALZdMPNmZ7W8ofKB5KERee66X2og) / [`62h7SnsL…`](https://testnet.nearblocks.io/txns/62h7SnsLzY9vmXZj2Nhu3roHhRDvSEuYi8WVqM1fcVPC) |

### What is verified and what is trusted

What the README says now, which phase 2 must not overstate:

- **Attestation is checked off chain**, then the signer is allowlisted. It does not compare the app image with a known-good one, since none is published.
- **The model can be wrong.** The red team uses our own 83 cases, not an adaptive attacker. A compromised agent can re-propose and get up to 30 verdicts an hour per wallet. The caps bound what one wrong `ALLOW` costs.
- **1Click is trusted to deliver.** The wallet verifies the signed quote, not the delivery on Base.
- **The team holds `intented-wallet.testnet`'s full-access key.** Factory wallets have none, and the mainnet wallet's key is deleted after setup.
- **The agent chooses what it passes as context.** The mandate check and the caps hold regardless.

## 2. Loose ends before phase 2

| Item | Owner | Next step |
| --- | --- | --- |
| Stale docs: the README's factory test row (6, now 9); the status board (wallet 31 → 57, core 126 → 141, no factory row); the firewall-core README still calls the seam "the seam William's API imports" | Furqaan | A small fix, one commit |
| Two records to confirm: "quote skips the recipient list" says "agreed by Furqaan", and a spec revision row (refused `execute` on `/api/executed`) lists William only | Furqaan | Confirm, or write a record that supersedes them |
| Other open Discord questions: 1 (signature retention, rotation), 4, 6, 8 (3 is closed: [OutLayer is cut](./decisions/2026-11-06-cut-outlayer.md)); William's 5 and 9 | Both | Only 1 affects the build (re-check the signer before mainnet); the rest can close as not needed |
| Latency: 6.0 s median against the 5 s bar; the slow tail is the model call | Both | Report it honestly, as the README does; no prompt change this late without a red-team rerun |

## 3. Phase 2 plan

| Day | Work | Gate |
| --- | --- | --- |
| **Sat 7 Nov**, integration day | The full flow in the UI on testnet: a new wallet made from the Create page with `intented init`'s key, rules set, an honest payment and the attack, receipts in Activity. Fix the loose ends above. Settle the MCP decision (section 4) | The flow works from a fresh browser |
| **Sun 8 Nov** | Furqaan: the `intented` npm package in `client/` (CLI, `pay()`, MCP server and skill), the API on EC2 ([steps](./hosting-ec2.md)), a hand check in Claude Code. William: the mainnet API with a daily verdict cap, the "Testnet \| Mainnet" switch and the small mainnet site | |
| **Mon 9 Nov** | Check the MCP by hand in Claude Code and Cursor; record a coding agent tricked into paying and the wallet refusing. The read-only preflight again (first run 6 November: signer unchanged, 1Click's key verifies live quotes, mainnet prompt hash computed) | The checks pass, or a fix is planned |
| **Tue 10 Nov** | **Feature-complete on testnet.** Rerun the red team only if the prompt or model changed | Nothing new after today but fixes |
| **Wed 11 Nov** | **Mainnet**, following [the runbook](./mainnet-runbook.md): `intented-wallet.near` via `deploy-wallet.sh`, 1Click's real key, 5 USDC within the $20–50 budget, the real $2 payment to Base through 1Click (KT4) and the Base attack refused on chain, then the full-access key deleted | **A yes from both owners before any step** |
| **Thu 12 Nov** | Video and X post (William). A final README pass with the mainnet hashes, every claim checked against the code (both) | |
| **Fri 13 Nov** | **Feature freeze.** Fresh-clone test: clone, install, run every test and one demo from the README alone | A stranger could follow the README |
| **Sat 14 Nov** | **Submit once**, by 20:00 IST (hard deadline 23:59 UTC). Furqaan fills in the form | Irreversible |

## 4. Proposed: Intented for Claude Code and Cursor

**Agreed 6 November: Furqaan builds it in a new `mcp/` folder, and it is the first thing cut if 10 November is tight.** Claude Code and Codex are among the judges, so this would let a judge's own coding agent pay through Intented. It also shows the problem where it happens: a coding agent reads a poisoned README or issue and tries to pay.

**What it is**

- **An MCP server** (stdio) for Claude Code, Cursor and Codex:
  - `intented_init(name)`: the agent's key and the Create link
  - `intented_pay(name, to, amount, token?, context)`: propose, verdict, execute
  - `intented_status(name)`: caps, today's spending, the last proposals
- **A Claude Code skill** that teaches the coding agent to pass what it read as `context` and never to reword a payment after a `DENY`. The same text works as a Cursor rule.
- A thin wrapper over `agent/`'s `initAgent`, `loadAgentKey` and `pay()`. The contract, core and API don't change.

**Settled and still to settle**

- **Lane.** It wraps William's code from a new `mcp/` folder that Furqaan owns, importing `@intented/agent`; William agreed on 6 November.
- **Dependency.** `@modelcontextprotocol/sdk`, replacing nothing, pinned to a release at least two weeks old.
- **Keys.** The key stays in `~/.intented/`; no tool result ever returns the private key.
- **Honesty.** The README says the coding agent chooses its context; the mandate and the caps still hold.
- **Setup for judges.** They run it from a clone (nothing is on npm), with their own testnet wallet.
- **Cost.** About a day. It is cut first if 10 November is tight.

## 5. Risks

| Risk | What we do |
| --- | --- |
| The deadline | The cut order: the MCP (new, proposed) → the mandate editor UI → the daily cap → the cross-chain leg (keep the NEAR-native payment). **The attack demo is never cut** |
| Real money on mainnet | Only after both owners say yes, only $20–50 in all, every step from the runbook. The full-access key is deleted once setup is checked |
| The real 1Click path is untested | The quote signature is checked against a live mainnet quote on 9 November, and the $2 payment is made on 11 November. If it fails, the README says so and the NEAR-native payment carries the demo |
| The signing key rotates | Re-attest before mainnet. A new signer is attested, published and allowlisted the same way |
| Claims outrun the code | Each README line is checked against the code and a hash before the freeze. AI judges read it |
| Secrets in a public repo | Keys stay in the password manager and `~/.intented/`; `.env` stays gitignored. Check `git log -p` for keys before submitting |

Sources: [the build plan](./Intented%20hackathon%20plan.pdf), [`decisions/`](./decisions/README.md) (39 records), [`README.md`](../README.md), [the status board](./README.md), and the test runs on 6 November: wallet 57, factory 9, firewall-core 141, api 90, agent 56, redteam 16, all passing.
