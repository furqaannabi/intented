# Intented

> Your agent only does what you intented.

An AI agent's NEAR wallet contract executes an action only when it carries a TEE-signed `ALLOW` verdict from NEAR AI Cloud. The verdict checks the action against the owner's plain-English mandate, and the contract verifies the signature on-chain.

Built at the NEAR Hackathon, 1–14 November 2026. Tracks: **AI Security & Defense** (agent security, function-call keys, TEE attestation), **Agent Economy**, **Privacy & Private AI**.

## The problem

Agents with wallets get prompt-injected. Spending caps and allowlists check rules, not meaning: a poisoned response that says "pay 10× to this address" while staying under the cap passes every rule. Intented checks each action against what the owner intended, and makes the contract refuse anything without a signed yes.

## How it works

1. The **agent** proposes an action with a function-call key scoped to the wallet.
2. The **firewall core** sends the owner's mandate and the action to a model running in a TEE on NEAR AI Cloud, with untrusted data quoted.
3. The model returns a **verdict**, `ALLOW` or `DENY` with a reason, and NEAR AI Cloud signs the request and response.
4. The **wallet contract** recovers the signer, checks it is allowlisted, checks the signed action is byte for byte the proposed one, and checks the nonce, expiry, caps and freeze switch.
5. On `ALLOW` it executes: a NEAR call, or a cross-chain payment through 1Click.
6. The **web app** shows the verdict, the signature, the attestation and the transactions.

**Trust assumptions:** the TEE attestation is verified off-chain and the signing address is then allowlisted on-chain; the contract does not verify the TDX quote. The contract's hard caps stay as the backstop, so the model can only tighten what the contract permits. See [the trust model](./docs/decisions/2026-11-01-signed-verdict-trust-model.md).

## Repo map

| Path | What | Owner |
| --- | --- | --- |
| [`contract/`](./contract/) | The wallet contract (near-sdk-rs) | Furqaan |
| [`firewall-core/`](./firewall-core/) | The firewall core library and the attestation checker (TypeScript) | Furqaan |
| [`api/`](./api/) | The HTTP API, proposal storage, the 1Click module | William |
| [`web/`](./web/) | The web app | William |
| [`agent/`](./agent/) | The demo agent and the mock x402 paywall | William |
| [`redteam/`](./redteam/) | Attack and benign cases and the `make redteam` runner | William |
| [`docs/`](./docs/README.md) | The build plan, the interface spec, the glossary, decisions | Both |

## Status

Day 1: the kill tests. Nothing is runnable yet. The status board is in [`docs/README.md`](./docs/README.md).

## License

[MIT](./LICENSE).
