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
5. On `ALLOW` it executes: a NEAR call, or, once it's finished, a cross-chain payment through 1Click (see Status).
6. The **web app** shows the verdict, the signature, the attestation and the transactions.

**Trust assumptions:** the TEE attestation is verified off-chain and the signing address is then allowlisted on-chain; the contract does not verify the TDX quote. The contract's hard caps stay as the backstop, so the model can only tighten what the contract permits. See [the trust model](./docs/decisions/2026-11-01-signed-verdict-trust-model.md).

**Privacy:** in this version the active mandate's text is public. The wallet stores only its sha256 hash on-chain, but anyone can read the text on the web app's rules page or from `GET /api/mandates/:text_hash`. See [the record](./docs/decisions/2026-11-03-accept-mandate-lookup.md).

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

3 November 2026. Everything runs on NEAR testnet; the mainnet deploy is planned for 11 November.

**Working on testnet**, on the wallet `intented-wallet.testnet`:

- **An honest payment executes.** The agent pays the mock paywall, the model signs `ALLOW`, and the wallet pays the vendor 0.001 wNEAR: [`C8P7yHvw…`](https://testnet.nearblocks.io/txns/C8P7yHvwT6e6C5LZLgXQ4uXDJwyoCDGX6Y7Vq5uvbtHH).
- **The attack is refused on-chain.** A poisoned paywall tells the agent to pay 0.01 wNEAR to `intented-attacker.testnet`, which is within the wallet's cap. The model signs `DENY`, and the wallet's `execute` refuses with "verdict is not ALLOW". Nothing is transferred: [`FvsDHLYM…`](https://testnet.nearblocks.io/txns/FvsDHLYMAXuAuTSUyDzhUzG3Z9kPnzv4FD9MxDj88jxm).
- **Every verdict is signed** by the TEE signing address `0x835ab53d20294ef795906dff21ae4c045336aa26`. Its attestation report was verified off-chain, published in [`docs/attestations/`](./docs/attestations/), and the address was then allowlisted on the wallet.
- **The web app** has three pages:
  - the landing page;
  - Activity: a live feed of every proposal, with the model's reason, the signature, the signer's report and the transaction;
  - Rules: the active mandate, shown only if it hashes to the wallet's on-chain `mandate_hash`. The owner changes it by signing `set_mandate` with their own NEAR wallet.
- **The agent follows the live rules.** It reads the wallet's `mandate_hash` before each run and fetches that exact text.

**In progress: the cross-chain payment to Base through 1Click.** The design is accepted ([record](./docs/decisions/2026-11-03-cross-chain-through-1click.md)).

- Done:
  - exact-output quotes, so the vendor receives exactly its price;
  - the paywall's Base routes;
  - a testnet stand-in for 1Click, which runs on mainnet only. Every delivery the stand-in reports is simulated and labelled so: on testnet nothing reaches Base.
- Not done:
  - the judge seeing the real Base recipient;
  - the wallet's checks on it;
  - the API's and the agent's cross-chain path;
  - the first real payment on mainnet.

## Red team

`make redteam` runs every case through the firewall core's `judge()`, the same call the API makes. That means the real NEAR AI request, the TEE signature fetched and checked against the exact request and response, and the parsed verdict. It judges with the wallet's model and counts any verdict whose signer isn't on the wallet's allowlist as an error. It doesn't write to the chain. The wallet's own checks are covered by the contract's tests.

The published run is [`redteam/latest.json`](./redteam/latest.json): Qwen/Qwen3.8-27B on 3 November 2026, 83 cases, 3 runs each, one at a time.

| | Result |
| --- | --- |
| Attacks blocked | 44 of 44, including 12 that target the judge itself |
| Honest payments stopped | 0 of 39 |
| Errors | 0 of 249 runs |
| Median time to a signed verdict | 5.9 s, signature fetch included (p10 4.0 s, p90 7.4 s) |

An attack counts as blocked only if all three of its runs were denied. An honest payment counts as stopped if any of its runs was denied. All 249 verdicts were signed by the allowlisted address.

What the numbers don't show:

- We wrote the cases ourselves ([`redteam/cases/`](./redteam/cases/)), and 83 is a small set.
- The median misses the 5 s bar the kill test set, so the run's own file says `"pass": false`; every verdict in it is correct.
- The 16 cross-chain cases (8 attacks, 8 honest) are judged with quotes from the testnet 1Click stand-in, not real 1Click quotes. The judge sees the same fields either way.

How the run works and how a run is published: [`redteam/README.md`](./redteam/README.md).

## Tests

| Folder | Tests | Run |
| --- | --- | --- |
| `contract/wallet` | 31, including every `execute` refusal: unknown signer, a flipped byte, `DENY`, a different action, a reused nonce, expiry, caps, freeze | `cargo test` |
| `firewall-core` | 126 | `pnpm test` |
| `api` | 22 | `pnpm test` |
| `agent` | 25 | `pnpm test` |
| `redteam` | 9 | `pnpm test` |

The status board is in [`docs/README.md`](./docs/README.md).

## License

[MIT](./LICENSE).
