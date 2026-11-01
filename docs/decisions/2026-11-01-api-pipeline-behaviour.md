# api: proposals run in the background, every verdict goes on-chain, and failed means no money moved

2026-11-01 · Decided by William · Status: accepted, except `updated_at` on `Proposal`, which changes the interface spec and is proposed, awaiting Furqaan

## Context

The [interface spec](../interface-spec.md) fixes the API's endpoints and shapes but not their behaviour. One proposal takes about 8–12 s end to end: a verdict from NEAR AI (about 4 s plus the signature fetch), then `propose` and `execute` on the wallet. `set_mandate` is owner-only, the API holds only the agent's function-call key, and the wallet refuses a verdict given under any mandate but the one whose hash it stores. Settled by grilling, question by question.

## Decision

1. **`POST /api/propose` replies at once** with `{ proposal_id }` and runs judge → `propose` → `execute` in the background. The agent and the UI poll.
2. **The API never holds the owner key.** `POST /api/mandate` stores the text and returns its hash; the owner puts the hash on the wallet with their own key. Before judging, the API reads the wallet's `mandate_hash` (a free view call) and fails the proposal if it does not match.
3. **Who may call:** `POST /api/propose` needs the agent's bearer token (`AGENT_API_TOKEN`), since it spends NEAR AI credit and signs with the agent key. `POST /api/mandate` is open, with a size limit, since it changes nothing on-chain. Reads are public.
4. **Every verdict goes on-chain, DENY included.** A DENY ends with the wallet's refused `execute` and its transaction hash, so the refusal is the contract's, not the API's.
5. **Request format:** `args` is the exact JSON string the wallet will send; `nonce`, `expiry_ms` and `deposit` are decimal strings. The API answers 400, before storing anything, if `args` does not hash to `args_sha256`, if the firewall core's encoder rejects a field, or if the action expires within 60 s.
6. **`near_tx_hash` is the `execute` transaction.** The `propose` hash is stored, not returned.
7. **`attestation_url`** comes from a map of signer to a published attestation report, or is `null`. The UI never shows a signer as attested without one.
8. **`since` means changed after `ts`**, so the UI sees status changes, and `Proposal` gains `updated_at` for the next `since`. *Proposed, awaiting Furqaan.* Until he agrees, the API filters on it but does not return it.
9. **Verdicts run in parallel; on-chain steps run one proposal at a time**, so two transactions never race for the agent key's nonce.
10. **No resuming after a restart.** On startup, and whenever a chain step throws, the API asks the wallet (`get_proposal`) what happened before marking anything `failed`. `failed` therefore always means the money did not move. The agent retries a `failed` proposal once with a fresh nonce, and never retries a `denied` one, since retrying a DENY gives an attacker another draw from a model that is sometimes inconsistent.

Statuses: ALLOW goes `pending → allowed → executed`, or `failed` if the call fails; DENY goes `pending → denied`; no verdict (NEAR AI down, no signature, mandate not active) goes `pending → failed` with no transactions.

## Consequences

- The UI can show a proposal appear, its verdict land, then its transaction confirm.
- A server restart can strand a proposal at `allowed` while the wallet's callback is outstanding; it is never marked `failed` while money might still move.
- The single chain queue caps throughput at about one proposal every few seconds, enough for a demo.
- Logs carry proposal ids, chat ids and transaction hashes only; never the context, the prompt or a key.
