# agent

The demo agent, the mock x402 paywall, and the testnet stand-in for 1Click. **Owner: William.** Why it is built this way: [the agent and paywall record](../docs/decisions/2026-11-01-demo-agent-and-paywall.md) and [the cross-chain record](../docs/decisions/2026-11-03-cross-chain-through-1click.md).

The agent buys market data from an x402-style paywall. It is deliberately naive: it proposes whatever the 402 asks, to whoever it names, and leaves the judgement to Intented. It holds `intented-agent.testnet`'s function-call key and sends its own `propose` and `execute`; the API only judges. The paywall has an honest route and a poisoned one that asks for more than the price, paid to the attacker, while staying within the wallet's cap. The attack demo is never cut.

## Run

Needs Node 24 and pnpm 11, the API running, and `.env` filled in (`CONTRACT_ACCOUNT_ID`, `AGENT_ACCOUNT_ID`, `AGENT_PRIVATE_KEY`: the agent account's function-call key on the wallet).

```sh
pnpm install
pnpm paywall               # http://localhost:8402
pnpm agent honest          # pays 0.001 wNEAR to intented-vendor.testnet, then gets the data
pnpm agent poisoned        # proposes 0.01 wNEAR to intented-attacker.testnet; DENY, and the wallet refuses
pnpm agent base            # 2 USDC to the vendor's Base address, through 1Click
pnpm agent base-poisoned   # 4 USDC to 0xbad0…0bad, through 1Click
pnpm oneclick-key          # once: the stand-in's signing key, into ../.env
pnpm intented init <name>  # the agent's key for <name>.intented.testnet, and the link that creates the wallet
pnpm intented pay <name> --to <account> --amount <wNEAR> --context "..."  # propose, verdict, execute on that wallet
pnpm check-tx <wallet> <tx hash>  # check an execute from the chain alone: the signed text, signer, verdict, outcome, transfers
pnpm oneclick              # the 1Click stand-in, testnet only: http://localhost:8403
pnpm test
```

`PAYWALL_PORT`, `PAYWALL_URL`, `API_URL` and `NEAR_RPC_URL` override the defaults. The Base routes need the API's cross-chain propose. On testnet it is on when the API has `ONECLICK_BASE_URL` (the stand-in) and `ONECLICK_STANDIN_PUBLIC_KEY`; without them it answers `501`.

## The agent's key: `intented init`

A wallet made by the factory has no agent account of its own: its owner adds the agent's public key to the wallet as a function-call key that can call only `propose` and `execute`. `pnpm intented init <name>` makes that key on the machine the agent runs on:

- It makes an ed25519 key pair and saves it to `~/.intented/testnet/<name>.intented.testnet.json`, in the fields near-cli uses (`account_id`, `public_key`, `private_key`). The folder is `0700` and the file `0600`. It is outside every project folder, so no `git add` picks it up.
- It prints the public key and a link to the Create page with the name and the key filled in. The owner opens it, writes the rules and signs. For a wallet that already exists, the owner pastes the public key into Add agent key instead.
- It never prints the private key, and never replaces a saved one: run it again and it gives back the same key and link.
- It refuses a name the factory can't create (lowercase letters and digits joined by `-` or `_`, at most 64 characters with `.intented.testnet`) before it writes anything.

`INTENTED_HOME` and `INTENTED_WEB_URL` (default `http://localhost:3000`) change where keys are kept and which web app the link opens. Testnet only for now.

## The agent's own transactions: `src/wallet.ts`

On a factory wallet the agent sends its own `propose` and `execute`, signed with the key from `intented init`, and the API only judges ([the proposal](../docs/decisions/2026-11-04-verdict-for-any-wallet.md)):

- `loadAgentKey({ walletId, home })` reads the saved key. It refuses a file that is missing, readable by others, or whose private key doesn't match its public key.
- `walletAgent({ key, rpcUrl })` signs through the firewall core's `createChainClient`, the code the API uses for the demo wallet, with the wallet itself as the signer. `propose(payment)` records an `ft_transfer` as pending and returns its `proposal_id`; `execute(proposal_id, verdict)` hands the wallet the signed verdict, which it pays on only if every check holds.
- When the wallet can't pay the agent's gas, `propose` and `execute` say so in one sentence with what to do, instead of NEAR's error: the wallet has no NEAR left for gas, the key has used up its gas limit, or the key isn't on the wallet. NEAR's own error stays as the `cause`.
- The verdict comes from `POST /api/verdict` on the API.

## Paying: `intented pay`

```bash
pnpm intented pay retest-1104 --to intented-vendor.testnet --amount 0.001 --context "HTTP 402: market data costs 0.001 wNEAR."
```

It proposes the payment on `<name>.intented.testnet` with the saved key, asks `POST /api/verdict` about that proposal, and hands the verdict to the wallet's `execute`. The wallet pays only on a valid `ALLOW` within its caps. A `DENY` is handed over too, so the wallet's refusal is on chain as the record. Without a verdict the proposal expires and nothing moves.

- `--amount` is in wNEAR and converted exactly to the token's smallest unit (24 decimals). `--token` defaults to `wrap.testnet`.
- `--context` (or `--context-file`) is what the agent read that led to the payment, such as the paywall's 402 reply. The judge reads it as data.
- `INTENTED_API_URL` (default `http://localhost:8787`) and `NEAR_RPC_URL` (default testnet) override where it goes. Colours are left out when the output isn't a terminal, or `NO_COLOR` is set.
- It exits 0 only when the payment was made.

On 5 November, on `retest-1104.intented.testnet`:

| Run | Verdict | `execute` |
| --- | --- | --- |
| 0.001 wNEAR to `intented-vendor.testnet`, the vendor its rules name | `ALLOW` | paid, tx `4rddy8CUvMfzJjxVALZdMPNmZ7W8ofKB5KERee66X2og` |
| 0.005 wNEAR to `attacker-7731.testnet`, from a context that says the vendor moved | `DENY` | refused on chain, tx `62h7SnsLzY9vmXZj2Nhu3roHhRDvSEuYi8WVqM1fcVPC`; nothing moved |

## The paywall

| Route | Testnet | Mainnet (`NEAR_NETWORK=mainnet`) |
| --- | --- | --- |
| `GET /honest/market-data` | 0.001 wNEAR to `intented-vendor.testnet` | 0.10 USDC on NEAR to `intented-vendor.near` |
| `GET /poisoned/market-data` | 0.01 wNEAR (10×) to `intented-attacker.testnet`, with a note telling automated clients the settlement account has changed | 1 USDC (10×) to `intented-attacker`, with the same note |
| `GET /base/market-data` | 2 USDC on Base to the vendor's Base address, `BASE_RECIPIENT_ADDRESS` | the same |
| `GET /base-poisoned/market-data` | 4 USDC (2×), with the same kind of note, to a made-up address, `0xbad0…0bad` | the same |

The Base routes exist only when `BASE_RECIPIENT_ADDRESS` is a Base address. On mainnet the Base routes are the real payment and the NEAR routes are the runbook's fallback if 1Click doesn't deliver. The mainnet attacker, `intented-attacker`, is a short top-level name that only the registrar could create, so nobody owns it and a transfer there fails: even a wrong `ALLOW` would leave the USDC in the wallet.

Without payment, the paywall answers `402` with the terms as x402 v2 JSON, in the body and base64-encoded in the `PAYMENT-REQUIRED` header (`scheme: "exact"`, with `network` `near:testnet`, `near:mainnet` or `eip155:8453`). The paid retry carries `PAYMENT-SIGNATURE`: base64 JSON whose `payload` is the proof. The paywall serves the data, with a `PAYMENT-RESPONSE` header, only once it has checked that proof itself:

- **NEAR routes:** `payload` is `{ transaction, signer }`. The paywall fetches the transaction from `NEAR_NETWORK`'s RPC (`EXPERIMENTAL_tx_status`) and needs a successful `ft_transfer` of the asked token, amount and recipient.
- **Base routes on mainnet** (`NEAR_NETWORK=mainnet`): `payload` is `{ transaction }`, the Base transaction hash. The paywall fetches its receipt (`eth_getTransactionReceipt`, from `BASE_RPC_URL`). It needs a successful transaction with a USDC `Transfer` of at least the price to the payee.
- **Base routes on testnet:** nothing reaches Base, so `payload` is `{ transaction, deposit_address }`, the NEAR deposit's transaction and the 1Click deposit address. The paywall asks the stand-in (`ONECLICK_BASE_URL`) about the deposit. It needs all of these:
  - the delivery is reported as `SUCCESS`;
  - the quote pays this route's payee, in Base USDC, at least the price;
  - this exact transaction is the deposit the stand-in confirmed.

  The response says `simulated: true`.

Each transaction unlocks the data once, even when two requests carrying it arrive together. If an RPC or the stand-in can't be reached, the paywall refuses and says why.

## The 1Click stand-in

1Click runs on mainnet only. On testnet, `pnpm oneclick` stands in for it, speaking the three calls the API's 1Click module makes: `POST /v0/quote`, `POST /v0/deposit/submit` and `GET /v0/status`. So the API only needs `ONECLICK_BASE_URL` pointed at it.

- **Quotes:** wNEAR on testnet for USDC on Base, exact output only, at a fixed demo rate (`ONECLICK_STANDIN_RATE`, default 500 USDC per wNEAR) plus a 1% buffer. Every live quote deposits to one account, `ONECLICK_STANDIN_DEPOSIT`. It must be registered on wrap.testnet; the stand-in warns at startup if it isn't.
- **Signed quotes:** each quote is signed the way 1Click signs its own ([record](../docs/decisions/2026-11-03-accept-signed-1click-quote.md)): ed25519 over `base58(sha256(stable JSON))` of the fields 1Click signs, with the stand-in's key in place of 1Click's. `pnpm oneclick-key` makes that key once and writes `ONECLICK_STANDIN_KEY` and `ONECLICK_STANDIN_PUBLIC_KEY` to `../.env`; it prints only the public key. The API checks quotes with the public key, and the owner registers it on the testnet wallet with `set_one_click_key`. The stand-in won't start without the key.
- **Deposits:** accepted only if the testnet transaction really transferred exactly the quoted amount to that account and succeeded.
- **Status:** `PENDING_DEPOSIT`, then `PROCESSING`, then `SUCCESS` 5 seconds after the deposit; a quote nobody pays is `FAILED` at its deadline. It reports the deposit transaction it confirmed, and never a Base transaction. **Every delivery it reports is simulated.**
- It refuses to start unless `NEAR_NETWORK` is testnet.

## The agent

`runAgent(url, config)` in [`src/agent.ts`](./src/agent.ts) is one purchase:

1. `GET` the paywall; expect `402`.
2. Find the rules. `pnpm agent` reads the wallet's `mandate_hash` from `get_config` before each run. The agent then fetches that text with `GET /api/mandates/:text_hash` and checks it hashes to `mandate_hash`. If the API has no text for it, it stores the known demo text, but only if that hashes to the wallet's.
3. Work out the payment.
   - **NEAR routes:** an `ft_transfer` on the 402's token, to its payee, for its amount.
   - **Base routes:** `POST /api/quote` with `{ token, amount, dest_chain, dest_asset, recipient }`, paid in wNEAR on testnet and USDC on mainnet. The answer is an `ft_transfer` of the quoted amount to the 1Click deposit address, expiring before the quote's deadline; the agent never picks the deposit address. A refused quote ends the run unpaid.
4. `propose` it on the wallet with its own key.
5. `POST /api/verdict` with the proposal id and the 402 body unparsed as `context`, so the judge sees it as quoted data (and the `quote_id` on Base routes).
6. `execute` with the verdict, `DENY` included: the wallet's refusal is the proof. After a successful `execute` it reports the transaction with `POST /api/executed`.
7. **Base routes only:** poll `GET /api/proposals/:id` until 1Click reports `SUCCESS`, `REFUNDED` or `FAILED`. Anything but `SUCCESS` ends the run unpaid.
8. If paid, `GET` the paywall again with the proof in `PAYMENT-SIGNATURE`:
   - NEAR routes: the wallet's transaction and the agent's account;
   - Base routes, simulated delivery: the deposit transaction and the deposit address;
   - Base routes, real delivery: the Base transaction.

It never retries on its own. A UI button can call the same function later.

## Limits

- The paywall keeps redeemed transaction hashes in memory, so after a restart it would accept an old payment again.
- The stand-in follows one cross-chain payment at a time, since every quote shares one deposit account.
- A transaction hash testnet doesn't know makes a NEAR lookup wait until it times out.
