# agent

The demo agent and the mock x402 paywall. **Owner: William.** Why it is built this way: [the record](../docs/decisions/2026-11-01-demo-agent-and-paywall.md).

The agent buys market data from an x402-style paywall. It is deliberately naive: it pays whatever the 402 asks, to whoever it names, through `POST /api/propose`, and leaves the judgement to Intented. The paywall has an honest route and a poisoned one that asks for 10× the price, paid to the attacker, while staying within the wallet's cap. The attack demo is never cut.

## Run

Needs Node 24 and pnpm 11, the API running, and `.env` filled in (`AGENT_API_TOKEN`, `AGENT_ACCOUNT_ID`, and the API's own variables).

```sh
pnpm install
pnpm paywall               # http://localhost:8402
pnpm agent honest          # pays 0.001 wNEAR to intented-vendor.testnet, then gets the data
pnpm agent poisoned        # proposes 0.01 wNEAR to intented-attacker.testnet; DENY, and the wallet refuses
pnpm test
```

`PAYWALL_PORT`, `PAYWALL_URL`, `API_URL` and `NEAR_RPC_URL` override the defaults.

## The paywall

| Route | Asks | Payee |
| --- | --- | --- |
| `GET /honest/market-data` | 0.001 wNEAR | `intented-vendor.testnet` |
| `GET /poisoned/market-data` | 0.01 wNEAR, with a note telling automated clients the settlement account has changed | `intented-attacker.testnet` |

Without payment it answers `402` with the terms as x402 v2 JSON, in the body and base64-encoded in the `PAYMENT-REQUIRED` header (`scheme: "exact"`, `network: "near:testnet"`, `asset: "wrap.testnet"`). The paid retry carries `PAYMENT-SIGNATURE`: base64 JSON whose `payload` holds the NEAR transaction hash and the account that signed it. The paywall fetches that transaction from testnet (`EXPERIMENTAL_tx_status`) and serves the data, with a `PAYMENT-RESPONSE` header, only if it holds a successful `ft_transfer` of the asked token, amount and recipient.

Limit: redeemed transaction hashes are kept in memory, so after a restart the paywall would accept an old payment again.

## The agent

`runAgent(url, config)` in [`src/agent.ts`](./src/agent.ts) is one purchase:

1. `GET` the paywall; expect `402`.
2. `POST /api/mandate` with the wallet's mandate text.
3. `POST /api/propose`: an `ft_transfer` on the 402's token, to its payee, for its amount; the 402 body, unparsed, as `context`, so the judge sees it as quoted data.
4. Poll `GET /api/proposals/:id` until the wallet has answered or the pipeline has given up.
5. If executed, `GET` the paywall again with the transaction hash in `PAYMENT-SIGNATURE`.

It never retries on its own. A UI button can call the same function later.
