# One repo, one folder per part, each owned by one person; decisions as dated records

2026-11-01 · Decided by Furqaan and William (build plan §11) · Status: accepted

## Context

The hackathon requires product code in a public repo created on or after 1 November, so this repo starts on that day. Two people build in parallel for fourteen days and need to merge without stepping on each other. The plan asked for a `DECISIONS.md` log.

## Decision

| Folder | What | Owner |
| --- | --- | --- |
| `contract/` | The wallet contract in near-sdk-rs | Furqaan |
| `firewall-core/` | The firewall core library and the attestation checker | Furqaan |
| `api/` | The HTTP API, proposal storage, the 1Click module | William |
| `web/` | The web app | William |
| `agent/` | The demo agent and the mock x402 paywall | William |
| `redteam/` | Attack and benign fixtures and the `make redteam` runner | William |
| `docs/` | The plan, the interface spec, the glossary, decisions | Both |

Each owner merges into their own folders. `docs/interface-spec.md` changes only with the other's review. `main` stays demo-able; each feature gets a branch.

Decisions are dated records in `docs/decisions/`, one file each, never edited after the fact, instead of one `DECISIONS.md`: interface changes, the model choice and cut-line calls all go there.

## Consequences

- Neither person edits the other's folders to unblock themselves; they write it up instead.
- Each part picks its own toolchain on Day 1–2, so there is no root workspace file yet.
- A machine reader (Claude Code and Codex are listed as AI judges) can follow every choice from its record.
