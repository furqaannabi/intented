# Intented

## Authority

**Human is architect. Agent is senior engineer.**

- **Two owners, two lanes.** Furqaan owns the security-critical core: `contract/`, `firewall-core/`, attestation, `mcp/` (agreed 6 November), mainnet deploys and the submission form. William owns the frontend, the demo and the backend around the core: `api/`, `web/`, `agent/`, `redteam/`, the video and the X post. A session works in its owner's folders only. If the work needs something from the other lane, write it up for the other owner instead of building it.
- **The interface spec is the one shared artifact.** It lives in `docs/interface-spec.md`. Code against it; never widen it quietly. A change needs both owners' agreement, a revision row, and a dated record in `docs/decisions/` when behaviour changes.
- **No spec ceremony.** This is a fourteen-day hackathon. `docs/Intented hackathon plan.pdf` is the brief; its day-by-day table is the build order.
- **Grill before building against an unsettled requirement.** Invoke `grill-me`: developer questions, one at a time, each with a recommended answer. The queue is "Not decided yet" in `docs/decisions/README.md`. Not before every feature; before every guess.
- **Before debugging, invoke `diagnose`.** Build the feedback loop first: one fixture, seconds to run.
- **Tests where wrongness is invisible** (see below), with `tdd`. Everywhere else, working code and a manual check are enough.
- Never make architecture decisions autonomously. Present 2–3 options with trade-offs; the human chooses. Record a real decision as a dated ADR in `docs/decisions/` (format in that folder's README). Never edit a record after the fact; write a new one that supersedes it.
- Never bulk-generate code. One contract method, one endpoint, one function at a time.
- **Before writing more than one document, show the list of files and what each will contain, and wait for a yes.**
- **Every commit and every push needs its own explicit ask.** "Commit and push" once does not carry forward.
- **Mainnet actions** (deploys, funded transactions) need a yes from both Furqaan and William first.
- If stuck or ambiguous: ask. Never guess on product behaviour.
- Flag risks immediately: anything that lets an action execute without a verified `ALLOW`, a claim in the README stronger than what the code verifies, secrets in this public repo, money moving on mainnet, and the deadline.

### Skills

Vendored in `.claude/skills/`.

| Skill | When |
| --- | --- |
| `grill-me` | Before building against a requirement that is not settled |
| `diagnose` | Before debugging. Feedback loop first |
| `tdd` | For the critical paths below, with its approval-before-code planning phase waived |
| `to-prd` | **Not used.** The build plan is the brief and no issue tracker is set up |

---

## Project

**Intented: your agent only does what you intented.** An AI agent's NEAR wallet contract executes an action only when it carries a TEE-signed `ALLOW` verdict from NEAR AI Cloud. The verdict checks the action against the owner's plain-English mandate, and the contract verifies the signature on-chain.

Built for the **NEAR Hackathon** (nearhackathon.com), 1–14 November 2026. Tracks: AI Security & Defense, Agent Economy, Privacy & Private AI. Judged on technical implementation, design, impact, originality and sustainability. **Claude Code and Codex are listed as AI judges**, so the README and the code are read by machines: plain statements, no marketing.

Team: **Furqaan** (contract, firewall core, submission), **William** (API, web, demo, red team).

| Milestone | When |
| --- | --- |
| Kill tests; go/no-go | 1 November |
| The real firewall core replaces the stub | 6 November |
| Integration day | 7 November |
| Feature-complete on testnet | 10 November |
| Mainnet deploy | 11 November |
| **Feature freeze** | 13 November |
| Submit, once, irreversible | 14 November, by 20:00 IST (hard deadline 23:59 UTC) |

### Key docs

| Doc | Path |
| --- | --- |
| Build plan (source of truth) | `docs/Intented hackathon plan.pdf` |
| Interface spec | `docs/interface-spec.md` |
| Glossary | `docs/glossary.md` |
| Decisions | `docs/decisions/` |
| Why this idea | `docs/NEAR hackathon idea selection.md`, `docs/research_notes/` |

---

## Trust rules

These are the product. Do not write code that bends them, and do not write copy that overstates them.

| Rule | Detail |
| --- | --- |
| **No verdict, no execution** | The contract executes only with a signature from an allowlisted signer over the exact request and response, a verdict of `ALLOW`, and a signed action that is byte for byte the proposed one |
| **The contract's caps are the backstop** | Per-transaction and daily caps, the allowlist and the freeze switch stay in the contract. The model can only tighten what the contract permits, never loosen it |
| **Attestation is off-chain** | The attestation report is verified off-chain, then the signer is allowlisted. Never claim the contract verifies the TDX quote |
| **Untrusted data is data** | Paywall responses, tool output and anything the agent read go into the prompt quoted, never as instructions. The verdict is structured JSON; anything that fails parsing is a `DENY` |
| **Fetch signatures immediately** | Straight after each call, since signing keys rotate |
| **A stub verdict is never shown as real** | Until the real core lands, nothing signed by the stub appears in the UI or a recording as verified |

---

## Security first

**The repo is public.**

| Concern | Rule |
| --- | --- |
| Secrets | The NEAR AI key, the 1Click JWT and every account key live in the shared password manager. Zero secrets in code, logs or the client bundle. `.env` is gitignored; `.env.example` carries names only |
| Keys | The agent holds a function-call key scoped to the wallet contract, nothing more. The web app never holds a private key |
| Logging | Never log keys, JWTs or whole prompts. Log proposal ids and transaction hashes |
| Mainnet | Small amounts only (budget $20–50), and only after both owners say yes |

---

## Tests that are not optional

Write a test wherever being wrong would be invisible, with `tdd`: one test, one implementation, repeat.

| Area | Must prove | Owner |
| --- | --- | --- |
| Canonical encoding | The firewall core and the contract produce identical bytes for the same action, including edge cases (large deposits, unicode receiver ids) | Furqaan |
| `execute` | Fails for: an unknown signer, one flipped byte in the request or response, `DENY`, a different action, a reused nonce, an expired action, over a cap, frozen. Succeeds only when everything holds | Furqaan |
| Function-call key | An out-of-scope call is rejected | Furqaan |
| Verdict parsing | Anything but valid structured JSON is a `DENY`, never a silent `ALLOW` | Furqaan |
| Red-team numbers | The block rate and false-positive rate published in the README come from `make redteam` on the real pipeline | William |

---

## Cut list

If integration slips past 7 November, cut in this order: optional OutLayer integration → mandate editor UI → daily cap → the cross-chain leg (keep the NEAR-native payment). **Never cut the attack demo.**

## What the agent cannot do

- Change the interface spec or the trust rules without both owners.
- Build in the other owner's folders.
- Commit a secret, a key or an `.env` file.
- Deploy to mainnet or move funds.
- Fill in or submit the hackathon form.
- Add a dependency without saying what it replaces and what it costs.
- Commit or push without being asked, each time.
