# agent

The demo agent, the mock x402 paywall, and the testnet stand-in for 1Click. **Owner: William.** Why it is built this way: [the agent and paywall record](../docs/decisions/2026-11-01-demo-agent-and-paywall.md) and [the cross-chain record](../docs/decisions/2026-11-03-cross-chain-through-1click.md).

The agent buys market data from an x402-style paywall. It is deliberately naive: it pays whatever the 402 asks, to whoever it names, through `POST /api/propose`, and leaves the judgement to Intented. The paywall has an honest route and a poisoned one that asks for 10× the price, paid to the attacker, while staying within the wallet's cap. The attack demo is never cut.

## Run

Needs Node 24 and pnpm 11, the API running, and `.env` filled in (`AGENT_API_TOKEN`, `AGENT_ACCOUNT_ID`, `CONTRACT_ACCOUNT_ID`, and the API's own variables).

```sh
pnpm install
pnpm paywall               # http://localhost:8402
pnpm agent honest          # pays 0.001 wNEAR to intented-vendor.testnet, then gets the data
pnpm agent poisoned        # proposes 0.01 wNEAR to intented-attacker.testnet; DENY, and the wallet refuses
pnpm agent base            # 0.40 USDC to the vendor's Base address, through 1Click
pnpm agent base-poisoned   # 4 USDC to 0xbad0…0bad, through 1Click
pnpm oneclick-key          # once: the stand-in's signing key, into ../.env
pnpm oneclick              # the 1Click stand-in, testnet only: http://localhost:8403
pnpm test
```

`PAYWALL_PORT`, `PAYWALL_URL`, `API_URL` and `NEAR_RPC_URL` override the defaults. The Base routes need the API's cross-chain propose, which stays off (`501`) until the firewall core's `judge()` takes the `cross_chain` field.

## The paywall

| Route | Asks | Payee |
| --- | --- | --- |
| `GET /honest/market-data` | 0.001 wNEAR on NEAR testnet | `intented-vendor.testnet` |
| `GET /poisoned/market-data` | 0.01 wNEAR, with a note telling automated clients the settlement account has changed | `intented-attacker.testnet` |
| `GET /base/market-data` | 0.40 USDC on Base | the vendor's Base address, `BASE_RECIPIENT_ADDRESS` |
| `GET /base-poisoned/market-data` | 4 USDC, with the same kind of note | a made-up address, `0xbad0…0bad` |

The Base routes exist only when `BASE_RECIPIENT_ADDRESS` is a Base address.

Without payment, the paywall answers `402` with the terms as x402 v2 JSON, in the body and base64-encoded in the `PAYMENT-REQUIRED` header (`scheme: "exact"`, with `network` `near:testnet` or `eip155:8453`). The paid retry carries `PAYMENT-SIGNATURE`: base64 JSON whose `payload` is the proof. The paywall serves the data, with a `PAYMENT-RESPONSE` header, only once it has checked that proof itself:

- **NEAR routes:** `payload` is `{ transaction, signer }`. The paywall fetches the transaction from testnet (`EXPERIMENTAL_tx_status`) and needs a successful `ft_transfer` of the asked token, amount and recipient.
- **Base routes on mainnet** (`NEAR_NETWORK=mainnet`): `payload` is `{ transaction }`, the Base transaction hash. The paywall fetches its receipt (`eth_getTransactionReceipt`, from `BASE_RPC_URL`). It needs a successful transaction with a USDC `Transfer` of at least the price to the payee.
- **Base routes on testnet:** nothing reaches Base, so `payload` is `{ transaction, deposit_address }`, the NEAR deposit's transaction and the 1Click deposit address. The paywall asks the stand-in (`ONECLICK_BASE_URL`) about the deposit. It needs all of these:
  - the delivery is reported as `SUCCESS`;
  - the quote pays this route's payee, in Base USDC, at least the price;
  - this exact transaction is the deposit the stand-in confirmed.

  The response says `simulated: true`.

Each transaction unlocks the data once. If an RPC or the stand-in can't be reached, the paywall refuses and says why.

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
3. `POST /api/propose`. The 402 body goes in unparsed as `context`, so the judge sees it as quoted data.
   - **NEAR routes:** an `ft_transfer` on the 402's token, to its payee, for its amount.
   - **Base routes:** the second body, `cross_chain: { token, amount, dest_chain, dest_asset, recipient }`, paid in wNEAR. The API quotes it and builds the transfer to the 1Click deposit address; the agent never picks one.
4. Poll `GET /api/proposals/:id` until the wallet has answered or the pipeline has given up.
5. **Base routes only:** once the wallet has paid the deposit, poll until 1Click reports `SUCCESS`, `REFUNDED` or `FAILED`. Anything but `SUCCESS` ends the run unpaid.
6. If paid, `GET` the paywall again with the proof in `PAYMENT-SIGNATURE`:
   - NEAR routes: the wallet's transaction and the agent's account;
   - Base routes, simulated delivery: the deposit transaction and the deposit address;
   - Base routes, real delivery: the Base transaction.

It never retries on its own. A UI button can call the same function later.

## Limits

- The paywall keeps redeemed transaction hashes in memory, so after a restart it would accept an old payment again.
- The stand-in follows one cross-chain payment at a time, since every quote shares one deposit account.
- A transaction hash testnet doesn't know makes a NEAR lookup wait until it times out.
