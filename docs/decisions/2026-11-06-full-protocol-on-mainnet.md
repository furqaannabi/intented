# The full protocol goes to mainnet, and factory wallets have cap ceilings

2026-11-06 · Decided by Furqaan, William · Status: accepted for the mainnet scope and the names; the cap ceilings are proposed (their spec rows need William's agreement)

## Context

The build plan put one wallet on mainnet on 11 November, and [the factory record](./2026-11-04-wallet-factory-on-testnet.md) kept the factory on testnet. On 6 November William asked for the full protocol on mainnet instead, "so anyone can create a real wallet": the factory, the demo wallet, the API, the site and the agent. He asked for guard rails: a notice on Create that the code is unaudited and only for small amounts, low caps on mainnet wallets, and a daily limit on verdicts. He asked whether the factory can enforce a maximum cap.

It can't today. `create` passes `setup` to the wallet's `new_with` unchecked, and an owner can raise caps later with `set_token` or `set_near_caps`. A factory wallet has no full-access key, so nobody can change its code afterwards. Any limit has to be in the wallet's code from the start.

## Decision

**Mainnet runs the full protocol.** Furqaan agreed on 6 November. The parts and their owners:

| Part | Mainnet | Owner |
| --- | --- | --- |
| Factory | `intented.near`; wallets are `<name>.intented.near` | Furqaan |
| Demo wallet | `demo.intented.near`, made by the factory, so it has no full-access key | Furqaan |
| Demo owner and vendor | `intented-owner.near`, `intented-vendor.near` | Furqaan |
| API, site, agent | A mainnet instance of each; the API judges with the mainnet prompt hash and real 1Click | William |
| Guard rails | The notice on Create; a daily limit on verdicts in the API | William |
| Cap ceilings | In the factory and the wallet, below | Furqaan |

**Cap ceilings (proposed).** The factory holds ceilings: per token, a maximum per-payment and daily cap, and a maximum for the NEAR caps. `create` passes them to the wallet's `new_with`. The wallet stores them, returns them in `get_config`, and refuses any cap above them, and any token without a ceiling, in `new_with`, `set_token` and `set_near_caps`. An owner can lower a cap, never raise it above the ceiling. Only the factory account can change the ceilings, with `set_ceilings`, and only for wallets created afterwards; a wallet keeps the ceilings it was made with. Wallets deployed without the factory (`new`) have no ceilings.

Proposed mainnet ceilings, to settle before deploy:

| Token | Per payment | Per day |
| --- | --- | --- |
| USDC (`17208628…33a1`) | 5 USDC | 20 USDC |
| USDt (`usdt.tether-token.near`) | 5 USDt | 20 USDt |
| wNEAR (`wrap.near`) | set from the NEAR price on the day, about $5 | about $20 |
| NEAR attached to an action | 1 yoctoNEAR | 100 yoctoNEAR (only the deposit `ft_transfer` needs) |

## Consequences

- **This supersedes "testnet only"** in [the factory record](./2026-11-04-wallet-factory-on-testnet.md) and the single mainnet wallet in [the runbook](../mainnet-runbook.md), which is rewritten for the factory.
- **What a stranger can lose is bounded by code**, not by a promise: 5 USDC a payment and 20 a day by default, whatever the model signs. The notice on Create says the code is unaudited. The README states the ceilings as the contract enforces them, and no more.
- **Costs.** The factory stores the wallet code, about 3.4 NEAR. Each wallet costs its creator about 3.8 NEAR in storage, which can't be recovered, because the wallet has no full-access key to delete the account. The Create page says so. Our own cost is the factory, the demo wallet, gas and a few dollars of USDC, inside the $20–50 budget at the day's NEAR price.
- **The team keeps the factory's key.** It can change the code and the ceilings for future wallets, as on testnet. `get_code_hash()` and the ceilings view show what a new wallet gets.
- **Verdicts cost us NEAR AI credits**, so the mainnet API needs its daily limit before the site is public.
- **Work, test-first:** the wallet stores and enforces the ceilings; the factory holds them and passes them on. Then a migration for `intented-wallet.testnet`, the testnet factory upgraded with generous ceilings, and the spec rows. To be ready by 9 November, ahead of the 10 November feature-complete date. The MCP is the first thing cut if this runs late.
- **Mainnet still needs a yes from both owners** before each deploy and every funded transaction, following the runbook.
