# Accepted: the `intented` npm package is published, and the testnet API is hosted

2026-11-10 · Decided by Furqaan, William · Status: accepted

## Context

[The proposed record](./2026-11-07-npm-package-intented.md) made one npm package, `intented`, from `client/`, bundling `agent/`'s `init`, `pay` and `wallet`, and had Furqaan host the API. It needed William's agreement. Before publishing, both owners wanted one honest payment and one attack through the hosted API.

The hosted API runs on AWS EC2 at `https://hack.furqaannabi.com`: pm2 on port 3001, behind nginx with a Let's Encrypt certificate, with port 3001 closed to the outside. That's simpler than the systemd and Caddy setup the proposal described. The site `https://intented-near.vercel.app` reaches it through `API_URL` on Vercel.

On 10 November William reported both payments, run from the package built at `06dd718` against the hosted API, on `demo-wallet.intented.testnet`. Furqaan re-read both from the chain with `check-tx`:
- **Honest:** `6vxXq9dMDj5Ab8JD4JRtzfMVQnjfaeKLgdvVVke2F2gM`. The allowlisted signer `0x835ab53d…aa26` signed `ALLOW`, `execute` succeeded, and 0.001 wNEAR went to `intented-vendor.testnet`.
- **Attack:** `H3jfUHuTYYeDrTiiLZTWqJmUUBysQST4whfcL9zPjQQb`. The same signer signed `DENY`, `execute` was refused ("verdict is not ALLOW"), and nothing was transferred.

William's answer:

> Yes on the name intented, and yes on version 0.1.0. Go ahead and publish.

## Decision

- **The proposal is accepted:** one package, bundled from `agent/` without editing it, with William told before any change to those files' signatures.
- **`intented@0.1.0` is published** on npm by Furqaan (`furqaannabi`), from `904846a`. It was checked twice from an empty folder: once from the packed tarball before publishing, and again from the npm registry after. Both times the CLI, the library import and the MCP handshake worked, with 0 vulnerabilities. It defaults to the hosted API and site.
- **"API host (Railway or Render)" is settled: EC2,** as above. Deploys are by hand on the instance.

## Consequences

- A developer needs no clone: `npx intented init`, one signature on the Create page, then `pay()` or `npx -y intented mcp`.
- A published version can't be changed. Fixes go out as new versions, each checked from a packed tarball first.
- The box runs the API as root on Node 22. Before the submission it should move to a non-root user and Node 24, as `api/` declares. `docs/hosting-ec2.md` still describes the systemd setup and needs updating to what runs.
- The mainnet API (`mainnet.hack.furqaannabi.com`, port 8788) and the mainnet site are next. They follow William's settings, with `FACTORY_ACCOUNT_ID`, `ONECLICK_BASE_URL` and `ONECLICK_STANDIN_PUBLIC_KEY` set to empty rather than left unset. The API loads the testnet `.env` from the repo root and fills in any unset variable, so a missing `FACTORY_ACCOUNT_ID` would become `intented.testnet`.
