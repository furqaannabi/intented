# web

The web app: what the agent proposed, what the judge said and signed, and what the wallet did, plus the owner's own controls. **Owner: William.** It holds no private key: every change to a wallet is a transaction the owner signs in their own NEAR wallet, through [`@hot-labs/near-connect`](https://www.npmjs.com/package/@hot-labs/near-connect).

The testnet build is live at [intented-near.vercel.app](https://intented-near.vercel.app), on Vercel, with `API_URL` set to the hosted testnet API. The mainnet build runs locally only.

## Pages

| Page | What it shows |
| --- | --- |
| `/` | The landing page: the problem, how a verdict is made and checked, and, on the testnet build, a real `ALLOW` and a real `DENY` with their transactions |
| `/activity?wallet=<id>` | A live feed, polled every 3 seconds, of every payment the wallet's agent proposed. Each has a receipt: the model's reason as signed, what the agent read (shown as quoted data, never as instructions), the signer and signature, a link to the signer's attestation report, and the `propose` and `execute` transactions. A payment to Base shows 1Click's delivery status, and every testnet delivery is labelled simulated |
| `/rules` | The demo wallet's active rules, shown only if the text hashes to the wallet's on-chain `mandate_hash`; the browser hashes it itself |
| `/create` | Make a wallet on testnet: the owner writes the rules, sets the caps and the agent's gas allowance, and signs one `create` call on the factory. The link `intented init` prints fills in the name and the agent's key. Afterwards the page reads the new wallet back from the chain and checks its owner, rules hash, judge, code hash and agent |
| `/wallets` | The wallets you own, from the factory's `get_wallets`, and any you opened by name in this browser |
| `/wallets/<name>` | One wallet: its balance, rules, hard limits, agent key and gas, and its payments, live: a chart per day against the daily cap, and the latest five with the judge's reason. The owner can fund, withdraw, freeze, change the rules and add or remove the agent key |

The browser talks only to this app. The API routes it uses (`/api/mandate`, `/api/mandates/:hash`, `/api/proposals`, `/api/proposals/:id`, `/api/redteam/latest`) are proxied to `API_URL` ([`next.config.ts`](./next.config.ts)), and wallet state is read from NEAR's RPC.

## Run

Next.js 16 (App Router), React 19, TypeScript and Tailwind 4, with pnpm. Needs the [API](../api/README.md) running.

```sh
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
| `NEXT_PUBLIC_WALLET_ID` | `intented-wallet.testnet` unless set | required: the mainnet wallet, `intented-wallet.near` |
| `API_URL` | the testnet API | the mainnet API |
| Pages | everything | the mainnet wallet's receipts, rules and wallet page. Create and My wallets say wallets are made on testnet |

`NEXT_PUBLIC_TESTNET_URL` and `NEXT_PUBLIC_MAINNET_URL`, set on both builds, give the header its Testnet | Mainnet switch. `NEXT_DIST_DIR` gives a second build in the same checkout its own folder. Locally, the `web` and `web-mainnet` entries in `.claude/launch.json` run both, on :3000 and :3100.
