# The model sees token amounts already converted, and the wallet checks the conversion

2026-11-01 · Decided by Furqaan · Status: proposed (it changes the user message and the wallet's token setter, so it needs William's agreement)

## Context

After the switch to Qwen, the testnet wallet's honest payment (0.001 wNEAR, `amount` 1000000000000000000000) was denied. A differential loop sent that exact request six times per cell:

| | New prompt | Prompt before the day's change |
| --- | --- | --- |
| Qwen3.8-27B | ALLOW 0/6 ("0.1 wNEAR, exceeds 0.01") | ALLOW 0/6 |
| GLM-5.3-flash | ALLOW 1/6 ("1 wNEAR") | ALLOW 0/6 |

Neither the prompt change nor the model switch was the cause. The models misdivide a 22-digit integer by 10^24. Two probes confirmed it: the same payment in 6-decimal USDC passed 6/6, and the wNEAR payment with the amount given pre-converted passed 6/6. The same weakness explains KT3's arithmetic misses (GLM allowing 50 USDC against a 5 USDC cap; a 0.01 USDC payment read as 10).

## Decision

- **The firewall core converts.** For `ft_transfer` and `ft_transfer_call` on a token in its table, the user message gains `amount`: `args.amount` in whole tokens with the symbol, such as `"0.001 wNEAR"`. No rounding; trailing zeros trimmed. Rule 7 tells the model to judge by it and never convert itself. A known-token transfer without a canonical decimal string `amount` is refused before any call.
- **The wallet checks it.** `set_token(token_id, { symbol, decimals, caps })` replaces `set_token_caps`, and `get_token` replaces `get_token_caps`. `execute` formats `args.amount` with the stored decimals and symbol and rejects the request unless its `amount` is exactly that, and absent for any other call. Nobody holding the agent key and a NEAR AI key can show the model a false amount.

## Consequences

- With the conversion, both models allow the honest wNEAR payment 6/6. Qwen's full KT3: 20/20 attacks denied, 0/20 benign denied, no flaky cases.
- The Rust and TypeScript formatters are tested against each other on 11 amounts (`firewall-core/scripts/canonical-fixture.ts` writes `contract/wallet/tests/amount_fixture.json`), including the u128 maximum at 24 and 38 decimals. The contract rejects a false or missing amount; disabling that check fails a test.
- The symbol and decimals the owner sets must match the firewall core's token table, or every transfer of that token is refused.
- The wallet's state layout changed, so it was redeployed to `intented-wallet.testnet`.
- KT3's cases were all 6-decimal USDC; the red-team suite should gain 24-decimal wNEAR cases, honest and attack.
