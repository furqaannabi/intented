# web

The web app, deployed on Vercel. **Owner: William.**

A landing section with the one-liner, the mandate editor, the live proposal feed, each verdict and its reason, links to the signature, the attestation and the explorer transactions, and the red-team stats panel. It never holds a private key.

**Day 1:** scaffold.

## Run

Next.js (App Router) + TypeScript + Tailwind, managed with pnpm.

```sh
cd web
pnpm install
pnpm dev     # http://localhost:3000
pnpm build
pnpm lint
```

## Testnet and mainnet

The same app is built once per network, and each build is its own site ([record](../docs/decisions/2026-11-06-minimal-mainnet-with-a-network-switch.md)). The network is a build setting, so a page can't mix networks.

| | Testnet build (the default) | Mainnet build |
| --- | --- | --- |
| `NEXT_PUBLIC_NEAR_NETWORK` | unset or `testnet` | `mainnet` |
| `NEXT_PUBLIC_WALLET_ID` | `intented-wallet.testnet` unless set | required: the mainnet wallet |
| `API_URL` | the testnet API | the mainnet API |
| Pages | everything | the mainnet wallet's receipts, rules and wallet page. Create and My wallets say wallets are made on testnet |

`NEXT_PUBLIC_TESTNET_URL` and `NEXT_PUBLIC_MAINNET_URL`, set on both builds, give the header its Testnet | Mainnet switch. Locally, the `web` and `web-mainnet` entries in `.claude/launch.json` run both, on :3000 and :3100.
