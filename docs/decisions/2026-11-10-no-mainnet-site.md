# No mainnet site; the mainnet API is at hack.furqaannabi.com/mainnet

2026-11-10 · Decided by Furqaan · Status: proposed (the mainnet site and the switch are William's, so it needs his agreement)

## Context

[The minimal-mainnet record](./2026-11-06-minimal-mainnet-with-a-network-switch.md) builds the web app once per network and links the two builds with a "Testnet | Mainnet" switch. The mainnet build would have been a second Vercel project. On 10 November Furqaan chose not to add a second project.

Two other ways to get a switch were weighed:
- **One site with a live toggle.** William's record weighed and rejected this: every account, token, link, RPC and API address becomes a runtime value, and switching signs the visitor out. It's real work in `web/`, and 10 November is feature-complete day.
- **The mainnet build hosted on the EC2 box.** It would need a `basePath` change in `web/` to live under a path, or a new DNS record for a subdomain.

What the mainnet build would show is already checkable without it. The README's "On mainnet" section lists the 9 November payment and refused attack, with nearblocks and basescan links, and `check-tx` re-verifies each from the chain alone.

## Decision

- **No mainnet site is deployed.** `NEXT_PUBLIC_MAINNET_URL` stays unset on the `web` project, so the testnet site shows no switch. The two-build code stays in `web/`, ready if the mainnet site is wanted later.
- **The mainnet API runs** at `https://hack.furqaannabi.com/mainnet`, the same EC2 box as testnet:
  - pm2 process `intented-api-mainnet`, on `127.0.0.1:8788`;
  - nginx strips the `/mainnet` prefix;
  - it judges `intented-wallet.near` only, with at most 50 verdicts a day and no 1Click JWT (1Click charges its small unauthenticated fee).

  It started with an empty database, so it needs the mainnet mandate text (`02b0b128…`) stored before it can give a verdict.
- **Port 8788 is closed from outside.** The security group `launch-wizard-2` had a rule opening 8000–9000 to anyone, and nothing else on the box used that range. It was removed (`sgr-0db39a7b066bf6725`), so the mainnet API is reachable only through nginx.

## Consequences

- One web deploy, not two. Visitors only ever see testnet in the app, and mainnet's evidence lives in the README and on the explorers.
- The mainnet API's `WEB_ORIGINS` (`https://intented-near-mainnet.vercel.app`) points at a site that doesn't exist. That's harmless, since nothing calls it from a browser.
- If the mainnet site is wanted later, it's a second build with `API_URL=https://hack.furqaannabi.com/mainnet`, and `NEXT_PUBLIC_MAINNET_URL` set on both sites.
