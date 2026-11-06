# The mainnet site is a second build of the web app: the network is a build setting

2026-11-06 · Decided by William · Status: accepted

## Context

[Mainnet is one wallet; the product stays on testnet](./2026-11-06-one-mainnet-wallet.md) adds a second, small site for the mainnet wallet, reached by a "Testnet | Mainnet" switch. Two ways to build it were weighed:

- **One site with a live toggle.** Every account name, token, explorer link, RPC and API address becomes a runtime value; switching signs the visitor out of their NEAR wallet, since a connection is tied to one network; saved drafts and remembered wallets are kept per network; shared links carry the network.
- **Two builds of the same app**, one per network, each at its own address, with the switch linking between them.

## Decision

- The web app is built once per network. `NEXT_PUBLIC_NEAR_NETWORK` picks it, testnet unless set, and fixes the wallet, RPC, explorer links, tokens, factory and wording for that build. A mainnet build stops unless `NEXT_PUBLIC_WALLET_ID` names the wallet.
- The mainnet build shows only that wallet: its receipts, its rules and its wallet page. Create and My wallets say wallets are made on testnet and link there.
- The switch links to the other build's address (`NEXT_PUBLIC_TESTNET_URL`, `NEXT_PUBLIC_MAINNET_URL`), keeping the page where both builds have it.
- The API needs no switch: it already reads `NEAR_NETWORK`. With no factory it judges only its own wallet.

## Consequences

- A page can't mix networks, for example a testnet link on a mainnet receipt or a Fund button aimed at the wrong token contract.
- It costs a second web deploy, beside the second API that mainnet needs anyway.
- A visitor's NEAR wallet connection belongs to one site, so switching opens the other site signed out.
