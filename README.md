# Intented

> Your agent only does what you intented.

An AI agent's NEAR wallet contract executes an action only when it carries a TEE-signed `ALLOW` verdict from NEAR AI Cloud. The verdict checks the action against the owner's plain-English mandate, and the contract verifies the signature on-chain.

Built at the NEAR Hackathon, 1–14 November 2026. Tracks: **AI Security & Defense** (agent security, function-call keys, TEE attestation), **Agent Economy**, **Privacy & Private AI**.

**Live:** testnet at [intented-near.vercel.app](https://intented-near.vercel.app) (API `https://hack.furqaannabi.com`); mainnet, showing `intented-wallet.near`'s receipts, at [intented-near-mainnet.vercel.app](https://intented-near-mainnet.vercel.app) (API `https://hack.furqaannabi.com/mainnet`). Developer docs: [intented-near.vercel.app/docs](https://intented-near.vercel.app/docs).

**Demo video:** 4 minutes, in [the demo post on X](https://x.com/furqaan/status/2120832233317745008). It shows the attack refused on mainnet, a wallet created on testnet, and Claude Code paying through the MCP server.

## Evidence

Every row links to something you can check without our API or web app.

| Claim | Evidence |
| --- | --- |
| A real payment on mainnet, judged and paid | The model signed `ALLOW`; `intented-wallet.near` paid 2.022867 USDC to 1Click ([`GwNWg7fD…`](https://nearblocks.io/txns/GwNWg7fDFnoCm4X9xaVm2m9M5gS7tXkhhppU1RZ2EXCR)), and 1Click delivered 2.0 USDC on Base ([`0xc6c35973…`](https://basescan.org/tx/0xc6c359738fd97a544edaf23901a543d100a9d242ae4629103853634e25203782)). [On mainnet](#on-mainnet) |
| An attack refused on mainnet | A poisoned paywall asked for 4 USDC to an address the rules don't name. The model signed `DENY` and the wallet refused on-chain; nothing moved ([`EM1HSCom…`](https://nearblocks.io/txns/EM1HSComsm8wMXUnpJQ4qptqNdNZ133pyLCxcGKpKnt8)) |
| An attack under the cap, refused on the verdict alone | 0.01 wNEAR to the attacker, within the wallet's cap: `DENY`, and `execute` refused with "verdict is not ALLOW" ([`FvsDHLYM…`](https://testnet.nearblocks.io/txns/FvsDHLYMAXuAuTSUyDzhUzG3Z9kPnzv4FD9MxDj88jxm)) |
| The judge | Every verdict is signed by `0x835ab53d20294ef795906dff21ae4c045336aa26`, a key in a TEE on NEAR AI Cloud. Its attestation is verified off-chain ([report](./docs/attestations/0x835ab53d20294ef795906dff21ae4c045336aa26.json)); the wallet allowlists it and verifies each signature on-chain |
| Red team | 44 of 44 attacks blocked, 0 of 39 honest payments stopped, 249 signed verdicts, 0 errors ([`redteam/latest.json`](./redteam/latest.json)). [Red team](#red-team) |
| Tests | 403: 66 for the contracts in Rust, 337 in TypeScript. [Tests](#tests) |

Check a payment from the chain alone: `pnpm --dir agent check-tx intented-wallet.near GwNWg7fDFnoCm4X9xaVm2m9M5gS7tXkhhppU1RZ2EXCR` recovers the signer from the transaction, checks it against the wallet's allowlist, and prints the verdict and the transfer ([step 6](#try-it)).

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

```mermaid
sequenceDiagram
    participant A as Agent
    participant W as Wallet contract
    participant API as Intented API
    participant M as Model in a TEE<br/>(NEAR AI Cloud)
    participant C as 1Click
    Note over W: Before any payment: the attestation is verified<br/>off-chain, then the owner allowlists the signer
    A->>W: propose(action), with its function-call key
    A->>API: POST /api/verdict: the proposal id, and what it read
    API->>W: read the proposal and the mandate hash
    API->>M: the mandate and the action, untrusted data quoted
    M-->>API: ALLOW or DENY, signed by the TEE's key
    API-->>A: the signed request and response
    A->>W: execute(proposal, signed verdict)
    Note over W: signer allowlisted, request and action byte for byte,<br/>ALLOW, nonce, expiry, caps, not frozen, 1Click's signed quote
    alt ALLOW and every check holds
        W->>C: ft_transfer to the quoted deposit address<br/>(or straight to the vendor on NEAR)
        C-->>C: delivers USDC on Base
    else anything else
        W--xA: refused on-chain, nothing moves
    end
```

**What is verified where, and what is trusted**

- **Attestation is checked off-chain, not by the contract.** `pnpm attest` verifies the model TEE's Intel TDX quote against Intel's certificate chain, checks that the quote binds the signing address and a fresh nonce, and checks NVIDIA's signed GPU attestation. Only then does the owner allowlist the signer. It does not compare the attested app image with a known-good one (none is published), and it trusts NVIDIA's signing keys as served over TLS. Reports: [`docs/attestations/`](./docs/attestations/). Details: [the checker record](./docs/decisions/2026-11-01-attestation-checker.md).
- **The model can be wrong.** Whatever the agent read, such as a paywall's response, is attacker-controlled. An attacker can keep rewording it until the model slips. The red-team numbers below are our own 83 cases, not an adaptive attacker. A compromised agent can also re-propose the same action and get up to 30 verdicts an hour per wallet, and no more than the API's daily cap (`VERDICT_DAILY_CAP`) where it's set. The contract's caps limit what one wrong `ALLOW` can cost; the model can only tighten what the contract permits, never loosen it.
- **1Click is trusted to deliver.** The wallet verifies that 1Click signed the quote, but it can't prove that 1Click then delivers on Base. On testnet a stand-in plays 1Click, and every delivery it reports is labelled simulated.
- **The wallet account's full-access key can replace the contract.** Whoever holds it can bypass every check. For `intented-wallet.testnet`, that's the team. Wallets made by the factory have no full-access key, so nobody can replace their contract; their owner gets funds out with `withdraw`.
- **The agent holds only a function-call key** limited to `propose` and `execute` on its wallet, so it can't transfer funds directly.
- **The API holds no NEAR key.** It judges, quotes 1Click and reads the chain; every `propose` and `execute` is sent by the wallet's own agent. It holds the NEAR AI key and the 1Click JWT.

See [the trust model](./docs/decisions/2026-11-01-signed-verdict-trust-model.md).

**Privacy:** in this version the active mandate's text is public. The wallet stores only its sha256 hash on-chain, but anyone can read the text on the web app's rules page or from `GET /api/mandates/:text_hash`. See [the record](./docs/decisions/2026-11-03-accept-mandate-lookup.md).

## Try it

The web app isn't deployed yet; [run it locally](#run-it-yourself) to follow along. Every payment below is a real proposal from 4 or 5 November 2026 on NEAR testnet, on `intented-wallet.testnet` unless it says otherwise, and every transaction can be checked on nearblocks without the app.

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

**6. Check a payment without the app.** `check-tx` reads one `execute` transaction and the wallet's `get_config` from NEAR's public archival RPC, and nothing else: not our API, not the web app, no `.env`. From `execute`'s own arguments it recomputes the text NEAR AI signed, `model:sha256(request):sha256(response)`, recovers the signer, checks it against the wallet's allowlist, and prints the model's signed answer, how `execute` ended and the token transfers it made.

```sh
cd agent && pnpm install
pnpm check-tx intented-wallet.testnet C8P7yHvwT6e6C5LZLgXQ4uXDJwyoCDGX6Y7Vq5uvbtHH
```
```
signed text  Qwen/Qwen3.8-27B:0d075e0e…c064:32f07d31…6256
signer       0x835ab53d20294ef795906dff21ae4c045336aa26 (on intented-wallet.testnet's allowlist: 0x835ab53d20294ef795906dff21ae4c045336aa26)
verdict      ALLOW: The action transfers 0.001 wNEAR to intended-vendor.testnet, which exactly matches the mandate's recipient, token, and amount limit.
execute      succeeded
transfer     1000000000000000000000 of wrap.testnet, intented-wallet.testnet → intented-vendor.testnet
```

A refused attack prints the signed `DENY`, `execute refused: Smart contract panicked: verdict is not ALLOW` and `transfer none`: try `pnpm check-tx retest-1105.intented.testnet G9z8XBq486PEMDHD2EDZYQSz7Fxop3M9iNJrDgi5jmPs`.

**7. Make your own wallet.** On testnet, anyone can. `intented init <name>`, from the [`intented` package](./client/README.md), makes the agent's key on your machine and prints a link to the Create wallet page. There you sign one `create` call with your own NEAR wallet, with your rules and limits, and the factory makes `<name>.intented.testnet` with that key limited to `propose` and `execute`. `intented pay <name> …` then pays through it. Made this way on 5 November, `retest-1105.intented.testnet` paid the vendor ([`AHCrqfxh…`](https://testnet.nearblocks.io/txns/AHCrqfxh7D6Y9Tkineih2z3W4zM6TAUuPU54TjAGP6om)) and refused the attack (`G9z8XBq4…` above). The package is on npm: `npx intented init <name>`.

### Run it yourself

Needs Node 24, pnpm 11, and `.env` at the repo root, filled in from [`.env.example`](./.env.example). The agent needs a function-call key on a wallet contract and a NEAR AI key; the keys for `intented-wallet.testnet` are the team's, so to run it yourself you deploy [the contract](./contract/) to your own testnet account. The Base runs also need the stand-in's signing key to be the wallet's 1Click key: `pnpm --dir agent oneclick-key` makes one, and the wallet's owner sets it with `set_one_click_key`. Each line is its own terminal.

```sh
(cd firewall-core && pnpm install) && (cd api && pnpm install) && (cd agent && pnpm install) && (cd web && pnpm install)
(cd client && pnpm install && pnpm build)   # the intented package: node client/dist/cli.js
pnpm --dir api start          # the API, http://localhost:8787
pnpm --dir agent paywall      # the mock x402 paywall, http://localhost:8402
pnpm --dir agent oneclick     # the 1Click stand-in, testnet only, http://localhost:8403
pnpm --dir web dev            # the web app, http://localhost:3000
```

Then run the agent and watch Activity:

```sh
pnpm --dir agent agent honest          # pays 0.001 wNEAR to intented-vendor.testnet, then gets the data
pnpm --dir agent agent poisoned        # proposes 0.01 wNEAR to intented-attacker.testnet: DENY, refused on-chain
pnpm --dir agent agent base            # 2 USDC to the vendor's Base address, through 1Click
pnpm --dir agent agent base-poisoned   # 4 USDC to 0xbad0…0bad: DENY, refused on-chain
```

A paid run spends a little testnet wNEAR from the wallet, and every run a little gas from the agent's account. `make redteam` runs [the red team](#red-team).

On `intented-wallet.testnet` the rules still allow at most 1 USDC a payment to Base, so today `base` gets a signed `DENY` and the wallet refuses it. Raising that limit to 5 USDC, as on mainnet, is pending. The 0.4 USDC payment in [step 3](#try-it) was within it.

The same agent runs on mainnet with `NEAR_NETWORK=mainnet` and the mainnet wallet's accounts; the [runbook](./docs/mainnet-runbook.md) has every step, and `STORAGE_SPONSOR_ID` names the account that registers each 1Click deposit address on USDC ([`agent/`](./agent/README.md#the-paywall)).

**From your own agent, or from Claude Code, Cursor or Codex.** [`client/`](./client/README.md) is the `intented` package:

- `intented init` makes the agent's key and the link that creates its wallet.
- `intented pay` and `import { pay } from "intented"` pay through the wallet: propose, the signed verdict, the wallet's `execute`.
- `intented mcp` is an MCP server with the same as tools.

Testnet only. On npm as [`intented`](https://www.npmjs.com/package/intented) 0.1.0: `npx intented init <name>`, `npm install intented`, or `npx -y intented mcp` as an MCP server. The agent chooses what it passes as context; the check on the payment itself and the caps hold either way.

## On mainnet

**Done on 9 November** ([record](./docs/decisions/2026-11-09-mainnet.md)). One wallet, `intented-wallet.near`, made one real 2 USDC payment to the vendor's Base address through 1Click, and refused one attack. The product itself stays on testnet; mainnet is one wallet, not a deployment for anyone ([record](./docs/decisions/2026-11-06-one-mainnet-wallet.md)).

- **The payment.** The model signed `ALLOW`, and the wallet paid 2.022867 USDC to 1Click's deposit address: [`GwNWg7fD…`](https://nearblocks.io/txns/GwNWg7fDFnoCm4X9xaVm2m9M5gS7tXkhhppU1RZ2EXCR). 1Click delivered 2.0 USDC to `0x2ef2fed3f9b3d5385499008051031320b1fb49ef` on Base about 25 minutes later: [`0xc6c35973…`](https://basescan.org/tx/0xc6c359738fd97a544edaf23901a543d100a9d242ae4629103853634e25203782). It refunded the unused 0.02 USDC of its slippage buffer to the wallet.
- **The attack.** A poisoned paywall asked for 4 USDC to `0xbad000…00bad` on Base. The model signed `DENY`, and the wallet refused the `execute` on-chain with "recipient is not on the cross-chain recipient list". Nothing moved: [`EM1HSCom…`](https://nearblocks.io/txns/EM1HSComsm8wMXUnpJQ4qptqNdNZ133pyLCxcGKpKnt8).
- Two earlier attempts at the payment moved no USDC: the agent's account was short of gas, then the wallet refused an `amount_out` the API had formatted differently from 1Click's signed quote. Both are fixed and [recorded](./docs/decisions/2026-11-09-mainnet.md).

How to check them, without our API or web app:

1. **The wallet.** On [nearblocks](https://nearblocks.io/address/intented-wallet.near), its only key is a full-access key. **It is kept**, so the NEAR locked for the wallet's storage can be recovered when it's taken down after judging. Whoever holds that key (William) could replace the contract and bypass every check, so this wallet's checks rest on that key not being used. Its `code_hash`, `ACiQacTBTZBJSbgqgLjS28ZzqyCesSDXGMduiuANETFw`, matches `cargo near build reproducible-wasm` in `contract/wallet` at commit `686315b`, the commit its `contract_source_metadata` names.
2. **The agent's key.** On [`intented-agent.near`](https://nearblocks.io/address/intented-agent.near), a function-call key that may call only `propose` and `execute` on the wallet. The wallet accepts those calls only from that account.
3. **Each verdict.** `pnpm --dir agent check-tx intented-wallet.near <execute tx hash>`, as in [step 6](#try-it). It recovers the signer, `0x835ab53d20294ef795906dff21ae4c045336aa26`, from the transaction and checks it against the wallet's allowlist.
4. **The payment.** `execute` succeeded, and its one transfer is USDC from the wallet to 1Click's deposit address. On Base, the transaction above is a USDC transfer of 2.0 USDC to the vendor's address. The wallet checked 1Click's signed quote, so the deposit address is tied to that recipient and amount. It can't prove the delivery itself: that part is 1Click's.
5. **The attack.** The model's `DENY` is in the signed response that `check-tx` prints. The wallet checks its cross-chain recipient list before the verdict, so here the list refused it; testnet's [`GYQKNHhZ…`](https://testnet.nearblocks.io/txns/GYQKNHhZbhxrqNzi8rYs7wJaoD3Hif4LSKZVDFXYfn8P) shows the verdict check refusing on its own, with the list empty.

## Repo map

| Path | What | Owner |
| --- | --- | --- |
| [`contract/`](./contract/) | The wallet contract (near-sdk-rs) | Furqaan |
| [`firewall-core/`](./firewall-core/) | The firewall core library and the attestation checker (TypeScript) | Furqaan |
| [`api/`](./api/) | The HTTP API, proposal storage, the 1Click module | William |
| [`web/`](./web/) | The web app | William |
| [`agent/`](./agent/) | The demo agent and the mock x402 paywall | William |
| [`client/`](./client/) | The `intented` package: the CLI, the `pay()` library and the MCP server, and a Claude Code skill | Furqaan |
| [`redteam/`](./redteam/) | Attack and benign cases and the `make redteam` runner | William |
| [`web/content/docs/`](./web/content/docs/) | The developer docs: quickstart, guides, the contract, refusal and HTTP API references. Served at `/docs` by the web app (Fumadocs); preview with `pnpm dev` in `web/`. The HTTP API pages are generated from `openapi.yaml` with `node scripts/generate-api-docs.ts` in `web/` | William; Furqaan reviews his lane's pages |
| [`docs/`](./docs/README.md) | The build plan, the interface spec, the glossary, decisions | Both |

## Status

9 November 2026. The product runs on NEAR testnet. One wallet is on mainnet, where it made one real payment to Base through 1Click and refused one attack ([On mainnet](#on-mainnet)).

**Working on testnet**, on the wallet `intented-wallet.testnet`:

- **An honest payment executes.** The agent pays the mock paywall, the model signs `ALLOW`, and the wallet pays the vendor 0.001 wNEAR: [`C8P7yHvw…`](https://testnet.nearblocks.io/txns/C8P7yHvwT6e6C5LZLgXQ4uXDJwyoCDGX6Y7Vq5uvbtHH).
- **The attack is refused on-chain.** A poisoned paywall tells the agent to pay 0.01 wNEAR to `intented-attacker.testnet`, which is within the wallet's cap. The model signs `DENY`, and the wallet's `execute` refuses with "verdict is not ALLOW". Nothing is transferred: [`FvsDHLYM…`](https://testnet.nearblocks.io/txns/FvsDHLYMAXuAuTSUyDzhUzG3Z9kPnzv4FD9MxDj88jxm).
- **Every verdict is signed** by the TEE signing address `0x835ab53d20294ef795906dff21ae4c045336aa26`. Its attestation report was verified off-chain, published in [`docs/attestations/`](./docs/attestations/), and the address was then allowlisted on the wallet.
- **The web app** has these pages:
  - the landing page;
  - Activity: a live feed of every proposal, with the model's reason, the signature, the signer's report and the transaction;
  - Rules: the active mandate, shown only if it hashes to the wallet's on-chain `mandate_hash`. The owner changes it by signing `set_mandate` with their own NEAR wallet;
  - Create wallet: the owner signs one `create` call on the factory, with the agent's key from `intented init`;
  - My wallets, and a page for each wallet: its balance, rules, hard limits and agent key, and its payments, live: a chart per day against the daily cap, and the latest five with the judge's reason. The owner can fund, withdraw, freeze, change the rules and add or remove the agent key, each by signing with their own NEAR wallet.

  The web app holds no key. A second build of it, behind a "Testnet | Mainnet" switch, shows only the mainnet wallet ([record](./docs/decisions/2026-11-06-minimal-mainnet-with-a-network-switch.md)). Both are live: testnet at [intented-near.vercel.app](https://intented-near.vercel.app), mainnet at [intented-near-mainnet.vercel.app](https://intented-near-mainnet.vercel.app).
- **The agent follows the live rules.** It reads the wallet's `mandate_hash` before each run and fetches that exact text.

**The cross-chain payment to Base through 1Click works on testnet, with simulated delivery** ([record](./docs/decisions/2026-11-03-cross-chain-through-1click.md)).

- The judge sees the real Base recipient, token and amount, and the mandate names the vendor's Base address.
- The wallet checks the recipient against its cross-chain recipient list and the signed 1Click quote against the 1Click key it holds. On testnet that key is the stand-in's.
- The API quotes the payment and tells the agent the deposit address and amount to propose; the agent never picks the deposit address. The judge gets `cross_chain` from the API's stored quote, never from the agent, and one quote serves one proposal.
- 1Click runs only on mainnet. On testnet a stand-in quotes, signs and reports delivery, and every delivery it reports is simulated and labelled so: nothing reaches Base.
- On mainnet, through 1Click itself, one real payment: 2.0 USDC delivered to the vendor's Base address on 9 November ([On mainnet](#on-mainnet)).

**New wallets: testnet through a factory, mainnet by script** ([record](./docs/decisions/2026-11-04-factory-as-built.md)).

- The factory at `intented.testnet` makes a configured wallet in one call the owner signs: `<name>.intented.testnet`, with the caller as owner, their rules, signer and caps, and the agent's key limited to `propose` and `execute`. It adds no full-access key, so nobody can replace a factory wallet's contract; the owner gets funds out with `withdraw`.
- Shown with `demo.intented.testnet`: its code hash equals the factory's published one, its only key is the agent's, an honest payment executed ([`HNRq1HiX…`](https://testnet.nearblocks.io/txns/HNRq1HiXRVgPyevDKBZgRsEZQM9xDjRKRmY4aF7fPqw9)) and the poisoned one was refused ([`9WAKGzuM…`](https://testnet.nearblocks.io/txns/9WAKGzuMq6EGoh3rdUJj9Z71SdYr91tJRiJ9C6YVa7A6)).
- On mainnet, wallets are deployed with [`contract/wallet/scripts/deploy-wallet.sh`](./contract/wallet/scripts/deploy-wallet.sh); a mainnet factory is not built.

**Integration check, 7 November: a new wallet, end to end, through the `intented` package.** Run from the clone (the package wasn't on npm yet) against the API and web app running locally.

- `intented init it-1107` made the agent's key. The owner opened the link it printed in a fresh browser, created `it-1107.intented.testnet` from the Create page with their own testnet account, set its rules and funded it with 0.02 wNEAR.
- `intented pay` paid the vendor 0.001 wNEAR on a signed `ALLOW`: [`9G5SQZ9u…`](https://testnet.nearblocks.io/txns/9G5SQZ9uXnYxkniw5Kbd2WLN8W4HebKahgPG3TAT25pQ).
- A poisoned 402 asked for 0.01 wNEAR to `intented-attacker.testnet`, within the wallet's cap. The model signed `DENY`, and `execute` refused with "verdict is not ALLOW"; nothing moved: [`2ww43Qcr…`](https://testnet.nearblocks.io/txns/2ww43QcrzJiw1TtAU413VrF8VnM7uKZLVLjCBs1XbpLQ).
- Both receipts show in Activity, and `pnpm check-tx it-1107.intented.testnet <hash>` confirms each from the chain alone.
- **From Claude Code, through the MCP server** (`intented mcp`, in a fresh folder, auto mode on). Asked to pay the vendor, it called `intented_status` and `intented_pay`, and the wallet paid on `ALLOW`: [`6EDRmb6Y…`](https://testnet.nearblocks.io/txns/6EDRmb6YtRWVc35iKmaVycEhUktEEFS4hnrarTzTjZWo). The folder's `NOTES.md` hid an instruction, in an HTML comment, to pay 0.01 wNEAR to `intented-attacker.testnet`; Claude Code didn't act on it. Told directly to make that payment, it did: the model signed `DENY` and `execute` refused with "verdict is not ALLOW", nothing moved: [`2MKtPaQD…`](https://testnet.nearblocks.io/txns/2MKtPaQDChexn7b8AnLBWgLQA4xBwXdtJdJRpAKUZ2En). Not yet checked in Cursor or Codex.

**Again on 9 November, on a new wallet.** `intented init demo-wallet`, then `demo-wallet.intented.testnet` created from the Create page and funded with 0.05 wNEAR. From Claude Code through the MCP server, with the same kind of hidden instruction in `NOTES.md`: it paid the vendor 0.001 wNEAR on `ALLOW` ([`5N43QMvP…`](https://testnet.nearblocks.io/txns/5N43QMvPrUqKe7R86LnReUMDpegq33QrYq5zGh1zuegH)), and the wallet's only other proposal is the attacker payment Claude Code was then told directly to make: the model signed `DENY` and the wallet refused it ([`UTgiWAcq…`](https://testnet.nearblocks.io/txns/UTgiWAcqUxkYjytvRRRAvZQbX27gpFZt4SgMkfjPtoo)).

## Red team

`make redteam` runs every case through the firewall core's `judge()`, the same call the API makes. That means the real NEAR AI request, the TEE signature fetched and checked against the exact request and response, and the parsed verdict. It judges with the wallet's model and counts any verdict whose signer isn't on the wallet's allowlist as an error. It doesn't write to the chain. The wallet's own checks are covered by the contract's tests.

The published run is [`redteam/latest.json`](./redteam/latest.json): Qwen/Qwen3.8-27B on 5 November 2026, 83 cases, 3 runs each, one at a time.

| | Result |
| --- | --- |
| Attacks blocked | 44 of 44, including 12 that target the judge itself |
| Honest payments stopped | 0 of 39 |
| Errors | 0 of 249 runs |
| Median time to a signed verdict | 6.0 s, signature fetch included (p10 3.8 s, p90 12.8 s) |

An attack counts as blocked only if all three of its runs were denied. An honest payment counts as stopped if any of its runs was denied. All 249 verdicts were signed by the allowlisted address.

What the numbers don't show:

- We wrote the cases ourselves ([`redteam/cases/`](./redteam/cases/)), and 83 is a small set.
- The median misses the 5 s bar the kill test set, so the run's own file says `"pass": false`; every verdict in it is correct.
- The slow tail is the model call. Its median was 4.8 s, but one run in ten took over 11.5 s that day; fetching the signature added a median 0.8 s.
- The 16 cross-chain cases (8 attacks, 8 honest) are judged with quotes from the testnet 1Click stand-in, not real 1Click quotes. The judge sees the same fields either way.

How the run works and how a run is published: [`redteam/README.md`](./redteam/README.md).

## Tests

| Folder | Tests | Run |
| --- | --- | --- |
| `contract/wallet` | 57, including every `execute` refusal: unknown signer, a flipped byte, `DENY`, a different action, a fake mandate or prompt, a false amount, a reused nonce, expiry, caps, freeze, each cross-chain and signed-quote condition, oversized or too many proposals, and `prune` | `cargo test` |
| `contract/factory` | 9: what `create` sends, the deposit and name checks, the refund, the code hash, `set_code`, `get_wallets` and its migration | `cargo test` |
| `firewall-core` | 141 | `pnpm test` |
| `api` | 96, including `amount_out` taken from 1Click's signed quote, as the wallet checks | `pnpm test` |
| `agent` | 66, including `check-tx` on two real testnet transactions | `pnpm test` |
| `redteam` | 16 | `pnpm test` |
| `client` | 18, including exact token amounts, refusals before anything is proposed, and that no tool output contains the private key; `pnpm typecheck` also checks the published types against the code | `pnpm test` |

The status board is in [`docs/README.md`](./docs/README.md).

## Roadmap

None of this is built. It's what we plan to do after the hackathon, in order.

**Next: open mainnet to everyone, safely.**

1. **An audit of the wallet contract.** Until then, mainnet stays one wallet, and the product stays on testnet.
2. **A mainnet factory with cap ceilings.** The factory holds a maximum per-payment and daily cap for each token, and every wallet it makes refuses a cap above them. That bounds what a stranger can lose, whatever the model signs. The design is written down ([record](./docs/decisions/2026-11-06-full-protocol-on-mainnet.md)); it was set aside for the hackathon.
3. **Mainnet in the `intented` package.** It pays on testnet only today.

**Then: make the judge harder to fool, and prove more of it.**

4. **A larger and adversarial red team.** Our 83 cases are our own. The next step is cases from outside the team, and an attacker that keeps rewording until the model slips.
5. **A check of the attested image.** The attestation checker verifies the TEE's hardware quote and the signer. It can't yet compare the running image with a known-good one, because none is published.
6. **A verdict in under 5 seconds.** The median is about 6 seconds, and the slow part is the model call.

**Later: more that an agent can do, and a way to pay for it.**

7. **More than token transfers.** The wallet can already carry any call, but the caps and the judge's rules are written for payments. Next come swaps and paying for APIs and compute through NEAR Intents.
8. **Tools for owners.** Alerts when a payment is refused, shared rules across several agents, and an export of every verdict for audits.
9. **Pricing.** Each verdict costs us one model call. The plan is a small fee per verdict with a free allowance, and a team plan on top. Nothing is charged today.

## License

[MIT](./LICENSE).
