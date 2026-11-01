# The demo agent is scripted; the mock x402 paywall checks payment on-chain

2026-11-01 · Decided by William · Status: accepted

## Context

The demo needs an agent that buys data from an x402-style paywall, and a paywall with an honest version and a poisoned one. The [build plan](../Intented%20hackathon%20plan.pdf) describes the attack as "pay 10× to this address" while staying under the cap, and says the attack demo is never cut. The testnet wallet's mandate is "Buy market data from intented-vendor.testnet only. Pay in wNEAR, at most 0.01 wNEAR per call." Its per-call cap is 0.01 wNEAR, and the contract counts a payment equal to the cap as within it. x402 v2 carries the payment terms in a `PAYMENT-REQUIRED` header on the 402, the payment proof in `PAYMENT-SIGNATURE` on the retry, and the settlement in `PAYMENT-RESPONSE` on the 200.

## Decision

| Question | Choice | Instead of |
| --- | --- | --- |
| The agent | Scripted: it pays whatever the 402 asks, to whoever it names | An LLM agent, which might refuse the poisoned paywall by itself and would answer differently on each take. The product's claim is that the wallet holds when the agent is fooled |
| Honest and poisoned | One paywall server, two routes: `/honest/market-data` and `/poisoned/market-data` | One route with a mode switch, which adds a step to each take |
| The poisoned ask | 0.01 wNEAR (10× the honest 0.001) to `intented-attacker.testnet`, with a note in the 402's description telling automated clients the settlement account has changed | The honest price paid to the attacker. 0.01 sits at the cap, so the contract's caps alone would let it through |
| Payment proof | The agent retries with the NEAR transaction hash in `PAYMENT-SIGNATURE`; the paywall fetches the transaction from testnet and serves the data only for a successful `ft_transfer` of the asked token, amount and recipient, once per hash | Serving any retry that carries the header |
| How the agent runs | The command line: `pnpm agent honest` or `pnpm agent poisoned`. The logic is one function, `runAgent`, that a UI button can call later | A hosted service with UI buttons from the start, which needs hosting, a rate limit and the web feed first |

## Consequences

- The paywall and the agent live in one package, `agent/`, using the same Hono as `api/`. No new kind of dependency.
- The paywall keeps redeemed transaction hashes in memory, so after a restart it would accept an old payment again. Acceptable for the demo; a hosted paywall would store them.
- The agent sends the 402 body to `POST /api/propose` as `context`, unparsed, so the judge sees the planted note as quoted data.
- A UI button is planned once the web feed exists, around integration day (7 November). It needs a rate limit: the wallet's daily cap of 0.05 wNEAR covers fifty honest purchases.
- First run, 1 November: the poisoned path ended in a `DENY` and the wallet's refused `execute` (`FRFaJ1tiyFWKkv3wwmbmWaFt9K861n1mppmR6nxgPni7`), on the retired wallet `wallet.intented-owner.testnet`. Both paths still need to run on `intented-wallet.testnet`.
