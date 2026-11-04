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
4. The **wallet contract** checks, on-chain, before paying:
   - **the signature:** NEAR AI's TEE signature over `model:sha256(request):sha256(response)` recovers an allowlisted signer;
   - **the request:** it is exactly what the firewall core sends, with no extra fields, under the owner's mandate (by hash) and our system prompt (by hash), for this exact action and arguments, and with the token amount the model was shown matching the contract's own conversion. A genuine `ALLOW` obtained with a different mandate, prompt or amount is refused;
   - **the verdict:** it's `ALLOW`, for this action;
   - **the wallet's own limits:** the nonce is unused, the action hasn't expired, the receiver is allowlisted, the per-transaction and daily caps hold, and the wallet isn't frozen.
5. On `ALLOW` it executes: a NEAR call, or a cross-chain payment through 1Click. For the cross-chain payment, the wallet also verifies 1Click's signed quote, so the deposit address it pays is tied to the recipient, asset and amount 1Click quoted.
6. The **web app** shows the verdict, the signature, the attestation and the transactions.

**What is verified where, and what is trusted**

- **Attestation is checked off-chain, not by the contract.** `pnpm attest` verifies the model TEE's Intel TDX quote against Intel's certificate chain, checks that the quote binds the signing address and a fresh nonce, and checks NVIDIA's signed GPU attestation. Only then does the owner allowlist the signer. It does not compare the attested app image with a known-good one (none is published), and it trusts NVIDIA's signing keys as served over TLS. Reports: [`docs/attestations/`](./docs/attestations/). Details: [the checker record](./docs/decisions/2026-11-01-attestation-checker.md).
- **The model can be wrong.** Whatever the agent read, such as a paywall's response, is attacker-controlled. An attacker can keep rewording it until the model slips. The red-team numbers below are our own 83 cases, not an adaptive attacker. The contract's caps limit what one wrong `ALLOW` can cost; the model can only tighten what the contract permits, never loosen it.
- **1Click is trusted to deliver.** The wallet verifies that 1Click signed the quote, but it can't prove that 1Click then delivers on Base. On testnet a stand-in plays 1Click, and every delivery it reports is labelled simulated.
- **The wallet account's full-access key can replace the contract.** Whoever holds it can bypass every check. For `intented-wallet.testnet`, that's the team. Wallets made by the factory have no full-access key, so nobody can replace their contract; their owner gets funds out with `withdraw`.
- **The agent holds only a function-call key** limited to `propose` and `execute` on its wallet, so it can't transfer funds directly.

See [the trust model](./docs/decisions/2026-11-01-signed-verdict-trust-model.md).

**Privacy:** in this version the active mandate's text is public. The wallet stores only its sha256 hash on-chain, but anyone can read the text on the web app's rules page or from `GET /api/mandates/:text_hash`. See [the record](./docs/decisions/2026-11-03-accept-mandate-lookup.md).

## Try it

The web app isn't deployed yet; [run it locally](#run-it-yourself) to follow along. Every payment below is a real proposal from 4 November 2026 on the testnet wallet `intented-wallet.testnet`, and every transaction can be checked on nearblocks without the app.

![The landing page: a poisoned paywall tells the agent to pay the attacker, and NEAR AI signs DENY](./docs/screenshots/landing.png)

**1. Open Activity and click a paid `intented-vendor.testnet` payment.** You see `Paid`: the model's reason as it signed it, what the agent read from the paywall (shown as data, never as instructions), the signer and the signature. The wallet paid 0.001 wNEAR: [`87erm1VG…`](https://testnet.nearblocks.io/txns/87erm1VG7rYf6iX88MCMk7RjbM1cXuQvWv151sdD49xz).

![A paid payment's receipt: ALLOW, the signed reason, the paywall's 402 as untrusted data](./docs/screenshots/activity-paid.png)

**2. Click a refused `intented-attacker.testnet` payment.** A poisoned paywall told the agent to pay 0.01 wNEAR to the attacker, which is within the wallet's cap. You see `Refused`: the model signed `DENY` and gave its reason, and the wallet's `execute` refused with "verdict is not ALLOW". Nothing was transferred: [`8YRdanaR…`](https://testnet.nearblocks.io/txns/8YRdanaR7J96YumVVj2MdGdVMSDP98vS8dzWDvVUoCo3).

![A refused payment's receipt: DENY, the signed reason, refused on-chain](./docs/screenshots/activity-refused.png)

**3. Click the Base payments.** `0x2ef2fe…b49ef` is the vendor's Base address: the model signed `ALLOW` for 0.4 USDC, and the wallet paid 0.000808 wNEAR to the 1Click deposit account ([`6ADu75vE…`](https://testnet.nearblocks.io/txns/6ADu75vEGwK8tKoPbw7Nfmh7BwTjJfX151WRYvDY5Vhg)). 1Click runs only on mainnet, so on testnet a stand-in plays its part, and the receipt labels the delivery `SIMULATED`: nothing reached Base. `0xbad000…00bad` is the attack: 4 USDC to an address the rules don't name. The model signed `DENY`, and the wallet refused it on-chain. With the vendor on the wallet's cross-chain recipient list, the list refuses it first ("recipient is not on the cross-chain recipient list": [`DbLMFYWs…`](https://testnet.nearblocks.io/txns/DbLMFYWsUf4r9DXAfnHfKf1NVyqacM9EVCyeb8nq3W5U)). With the list empty, the wallet refuses it on the verdict alone ("verdict is not ALLOW": [`GYQKNHhZ…`](https://testnet.nearblocks.io/txns/GYQKNHhZbhxrqNzi8rYs7wJaoD3Hif4LSKZVDFXYfn8P)).

![The Base payment's receipt: ALLOW, paid to the 1Click deposit account, delivery simulated](./docs/screenshots/activity-base.png)

![The Base attack's receipt: DENY, refused on-chain](./docs/screenshots/activity-base-refused.png)

**4. Open Rules.** You see the rules the agent pays by, in plain English, and the wallet's on-chain `mandate_hash` with "matches the text": your browser read the hash from the contract and hashed the text itself. Next to it are the limits the contract enforces whatever the model says: 0.01 wNEAR a payment, 0.05 a day, only `wrap.testnet`, one allowlisted signer.

![The Rules page: the live mandate, its hash matching the wallet's, and the contract's limits](./docs/screenshots/rules.png)

**5. Check the signer.** Every verdict above was signed by `0x835ab53d20294ef795906dff21ae4c045336aa26`. Its attestation report was verified off-chain and is published in [`docs/attestations/`](./docs/attestations/); the address was then allowlisted on the wallet. The contract doesn't verify the TDX quote itself.

### Run it yourself

Needs Node 24, pnpm 11, and `.env` at the repo root, filled in from [`.env.example`](./.env.example). The agent needs a function-call key on a wallet contract and a NEAR AI key; the keys for `intented-wallet.testnet` are the team's, so to run it yourself you deploy [the contract](./contract/) to your own testnet account. The Base runs also need the stand-in's signing key to be the wallet's 1Click key: `pnpm --dir agent oneclick-key` makes one, and the wallet's owner sets it with `set_one_click_key`. Each line is its own terminal.

```sh
(cd firewall-core && pnpm install) && (cd api && pnpm install) && (cd agent && pnpm install) && (cd web && pnpm install)
pnpm --dir api start          # the API, http://localhost:8787
pnpm --dir agent paywall      # the mock x402 paywall, http://localhost:8402
pnpm --dir agent oneclick     # the 1Click stand-in, testnet only, http://localhost:8403
pnpm --dir web dev            # the web app, http://localhost:3000
```

Then run the agent and watch Activity:

```sh
pnpm --dir agent agent honest          # pays 0.001 wNEAR to intented-vendor.testnet, then gets the data
pnpm --dir agent agent poisoned        # proposes 0.01 wNEAR to intented-attacker.testnet: DENY, refused on-chain
pnpm --dir agent agent base            # 0.4 USDC to the vendor's Base address, through 1Click
pnpm --dir agent agent base-poisoned   # 4 USDC to 0xbad0…0bad: DENY, refused on-chain
```

A paid run spends a little testnet wNEAR from the wallet, and every run a little gas from the agent's account. `make redteam` runs [the red team](#red-team).

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

4 November 2026. Everything runs on NEAR testnet; the mainnet deploy is planned for 11 November.

**Working on testnet**, on the wallet `intented-wallet.testnet`:

- **An honest payment executes.** The agent pays the mock paywall, the model signs `ALLOW`, and the wallet pays the vendor 0.001 wNEAR: [`C8P7yHvw…`](https://testnet.nearblocks.io/txns/C8P7yHvwT6e6C5LZLgXQ4uXDJwyoCDGX6Y7Vq5uvbtHH).
- **The attack is refused on-chain.** A poisoned paywall tells the agent to pay 0.01 wNEAR to `intented-attacker.testnet`, which is within the wallet's cap. The model signs `DENY`, and the wallet's `execute` refuses with "verdict is not ALLOW". Nothing is transferred: [`FvsDHLYM…`](https://testnet.nearblocks.io/txns/FvsDHLYMAXuAuTSUyDzhUzG3Z9kPnzv4FD9MxDj88jxm).
- **Every verdict is signed** by the TEE signing address `0x835ab53d20294ef795906dff21ae4c045336aa26`. Its attestation report was verified off-chain, published in [`docs/attestations/`](./docs/attestations/), and the address was then allowlisted on the wallet.
- **The web app** has three pages:
  - the landing page;
  - Activity: a live feed of every proposal, with the model's reason, the signature, the signer's report and the transaction;
  - Rules: the active mandate, shown only if it hashes to the wallet's on-chain `mandate_hash`. The owner changes it by signing `set_mandate` with their own NEAR wallet.
- **The agent follows the live rules.** It reads the wallet's `mandate_hash` before each run and fetches that exact text.

**The cross-chain payment to Base through 1Click works on testnet, with simulated delivery** ([record](./docs/decisions/2026-11-03-cross-chain-through-1click.md)).

- The judge sees the real Base recipient, token and amount, and the mandate names the vendor's Base address.
- The wallet checks the recipient against its cross-chain recipient list and the signed 1Click quote against the 1Click key it holds. On testnet that key is the stand-in's.
- The API quotes the payment and builds the transfer to the deposit address; the agent never picks one. A retried propose with the same `Idempotency-Key` gets the first proposal back, so it can't pay twice.
- 1Click runs only on mainnet. On testnet a stand-in quotes, signs and reports delivery, and every delivery it reports is simulated and labelled so: nothing reaches Base.
- Not done: the first real payment on mainnet, through 1Click itself.

**New wallets: testnet through a factory, mainnet by script** ([record](./docs/decisions/2026-11-04-factory-as-built.md)).

- The factory at `intented.testnet` makes a configured wallet in one call the owner signs: `<name>.intented.testnet`, with the caller as owner, their rules, signer and caps, and the agent's key limited to `propose` and `execute`. It adds no full-access key, so nobody can replace a factory wallet's contract; the owner gets funds out with `withdraw`.
- Shown with `demo.intented.testnet`: its code hash equals the factory's published one, its only key is the agent's, an honest payment executed ([`HNRq1HiX…`](https://testnet.nearblocks.io/txns/HNRq1HiXRVgPyevDKBZgRsEZQM9xDjRKRmY4aF7fPqw9)) and the poisoned one was refused ([`9WAKGzuM…`](https://testnet.nearblocks.io/txns/9WAKGzuMq6EGoh3rdUJj9Z71SdYr91tJRiJ9C6YVa7A6)).
- On mainnet, wallets are deployed with [`contract/wallet/scripts/deploy-wallet.sh`](./contract/wallet/scripts/deploy-wallet.sh); a mainnet factory is not built.

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
| `contract/wallet` | 57, including every `execute` refusal: unknown signer, a flipped byte, `DENY`, a different action, a fake mandate or prompt, a false amount, a reused nonce, expiry, caps, freeze, each cross-chain and signed-quote condition, oversized or too many proposals, and `prune` | `cargo test` |
| `contract/factory` | 6: what `create` sends, the deposit and name checks, the refund, the code hash, `set_code` | `cargo test` |
| `firewall-core` | 141 | `pnpm test` |
| `api` | 74 | `pnpm test` |
| `agent` | 34 | `pnpm test` |
| `redteam` | 16 | `pnpm test` |

The status board is in [`docs/README.md`](./docs/README.md).

## License

[MIT](./LICENSE).
