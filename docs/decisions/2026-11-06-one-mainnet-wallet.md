# Mainnet is one wallet; the product stays on testnet

2026-11-06 · Decided by Furqaan, William · Status: accepted. Supersedes [the full protocol on mainnet](./2026-11-06-full-protocol-on-mainnet.md)

## Context

Earlier on 6 November we agreed to put the full protocol on mainnet: the factory, wallets for anyone, and cap ceilings in the wallet code to bound what a stranger could lose. William then proposed something smaller. Furqaan agreed, the same day.

His words:

> B, with one addition: I'll add a "Testnet | Mainnet" switch. The mainnet site is a second, small deploy that shows only the mainnet wallet: its receipts, rules and wallet page, with Create hidden. The product stays on testnet. So: one wallet via deploy-wallet.sh, the real $2 1Click payment to Base and one refused attack, plus a mainnet API to judge them, which you'd need anyway. Yes from me once the runbook is written.

Testnet already shows everything except one thing: a real 1Click delivery to Base. On testnet a stand-in plays 1Click, and every delivery is labelled simulated.

## Decision

- **One mainnet wallet**, `wallet.intented.near`, deployed with [`deploy-wallet.sh`](../../contract/wallet/scripts/deploy-wallet.sh) and owned by `intented-owner.near`. The demo agent is `intented-agent.near`, with a function-call key on the wallet. The vendor is `intented-vendor.near`. Its full-access key is deleted after setup, as [the bounded-proposals record](./2026-11-04-bounded-proposals-and-mainnet-key.md) decided.
- **The payments:** the real $2 payment to the vendor's Base address through 1Click (KT4), and one attack the wallet refuses on chain. As a fallback if 1Click doesn't deliver: a NEAR-native honest payment and a poisoned one.
- **A mainnet API** that judges only that wallet, with the mainnet prompt hash and real 1Click (William).
- **A second, small site** for the mainnet wallet, reached by a "Testnet | Mainnet" switch. It shows that wallet's receipts, rules and wallet page; Create is hidden (William).
- **The factory stays testnet only.** No mainnet factory and no cap ceilings. Everyone who tries the product does so on testnet.
- Steps: [the mainnet runbook](../mainnet-runbook.md). William's yes is given once it is written. Each deploy and funded transaction still needs both owners' yes on the day.

## Consequences

- No one else's money is in unaudited code. The ceilings, their spec rows and the migrations aren't needed, and the time goes to the MCP and the demo.
- The README says what is on mainnet: one wallet, and the transactions listed. It doesn't say "live on mainnet" of the product.
- The mainnet site labels everything as mainnet and links mainnet nearblocks. Nothing on testnet is labelled real.
- `/api/verdict` on the mainnet API is open, but it judges only our wallet, so its limit of 30 an hour bounds our NEAR AI spend. A daily cap is still cheap insurance.
