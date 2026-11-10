# The mainnet site is deployed after all, with the switch

2026-11-10 · Decided by Furqaan, William · Status: accepted. Supersedes [no mainnet site](./2026-11-10-no-mainnet-site.md)

## Context

Earlier on 10 November Furqaan proposed no mainnet site, to avoid a second Vercel project ([record](./2026-11-10-no-mainnet-site.md)). William disagreed:

> On the mainnet site, I'd rather keep it. It's the only place a judge sees the real payment and the refusal as receipts, not just hashes, and with the API up it's one Vercel project.

The mainnet API was already up at `https://hack.furqaannabi.com/mainnet`, so the site cost only the project and a deploy. Furqaan agreed the same day.

## Decision

- **The mainnet site is the second build** that [the minimal-mainnet record](./2026-11-06-minimal-mainnet-with-a-network-switch.md) describes: the Vercel project `intented-near-mainnet`, framework Next.js, root directory `web`, at `https://intented-near-mainnet.vercel.app`. Its settings:
  - `NEXT_PUBLIC_NEAR_NETWORK=mainnet`
  - `NEXT_PUBLIC_WALLET_ID=intented-wallet.near`
  - `API_URL=https://hack.furqaannabi.com/mainnet`
  - `SITE_URL=https://intented-near-mainnet.vercel.app`
  - `NEXT_PUBLIC_TESTNET_URL` and `NEXT_PUBLIC_MAINNET_URL`, which are set on the testnet project `web` too
- **The switch shows on both sites** and links each to the other.
- **The mainnet API's database is William's export from the 9 November run.** It holds the mainnet mandate (`02b0b128…`) and the four proposals: the paid payment `GwNWg7fD…`, the refused attack `EM1HSCom…`, and two earlier attempts that failed and moved no money. The empty database it replaced is kept in `/var/lib/intented/backup-20261110/` on the box.
- **The site is deployed from a fresh clone of `main`,** never from a working folder that holds `.env` files.

## Consequences

Checked on 10 November:
- every page of the mainnet site, and its API routes through the mainnet API, return 200;
- the four receipts show;
- the Rules page names `intented-wallet.near` and has no testnet links;
- the switch works in both directions.

The mainnet API's `WEB_ORIGINS` (`https://intented-near-mainnet.vercel.app`) now names a real site.

Two deploys, by hand: a change to `web/` reaches mainnet only when someone deploys `intented-near-mainnet` again.
