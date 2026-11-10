# Hosting the API on EC2

How the Intented API (`api/`) runs on AWS EC2, as of 10 November 2026. Decisions: [hosting and the package](./decisions/2026-11-10-accept-npm-package-and-hosting.md), [no mainnet site](./decisions/2026-11-10-no-mainnet-site.md).

| | Testnet | Mainnet |
| --- | --- | --- |
| URL | `https://hack.furqaannabi.com` | `https://hack.furqaannabi.com/mainnet` |
| pm2 process | `intented-api` | `intented-api-mainnet` |
| Port, local only | 3001 | 8788 |
| Settings | `~/intented/.env` | `/etc/intented/api-mainnet.env` |
| Database | `/root/intented-data/testnet.db` | `/var/lib/intented/mainnet.db` |
| Site | `https://intented-near.vercel.app` | none: the README's On mainnet section and `check-tx` |

**No secret goes in this repo or this file.** The NEAR AI key, and on mainnet the 1Click JWT, are pasted from the shared password manager into root-only (`600`) settings files on the instance. The API holds no NEAR key and no AWS credentials.

## The instance

- **Machine:** Ubuntu 24.04, public IP `44.221.26.202` (keep it as an Elastic IP, so DNS survives a stop and start).
- **Security group** `launch-wizard-2`: 80 and 443 from anywhere. Ports 3001 and 8788 stay closed: the API listens on every interface, so only nginx may reach it. A rule opening 8000–9000 to anyone exposed 8788 and was removed on 10 November. Port 22 is still open to anyone, and 18789 too with nothing listening; both are worth narrowing.
- **Shared box.** It also serves other projects (elapse, sponing, memed) from the same `/etc/nginx/nginx.conf`. Back up the file, edit it, run `nginx -t`, and reload only if that passes.
- **HTTPS:** nginx serves `hack.furqaannabi.com` with a Let's Encrypt certificate from certbot. `/` goes to 3001; `/mainnet/` goes to 8788, with the prefix stripped. Both pass `X-Forwarded-For`, which `TRUST_PROXY=1` reads.
- **Runs as root today.** Before the submission it should move to a non-root user and to Node 24, which `api/` declares. The box has Node 22.22.

## Testnet

```sh
git clone https://github.com/furqaannabi/intented.git ~/intented
cd ~/intented
pnpm --dir firewall-core install --frozen-lockfile
pnpm --dir api install --frozen-lockfile
mkdir -p /root/intented-data
# ~/intented/.env: copied from the password manager (names as in .env.example), chmod 600; PORT=3001,
# DATABASE_PATH=/root/intented-data/testnet.db, TRUST_PROXY=1, WEB_ORIGINS=https://intented-near.vercel.app, VERDICT_DAILY_CAP=200
cd ~/intented/api
pm2 start node_modules/tsx/dist/cli.mjs --name intented-api -- src/server.ts
pm2 save && pm2 startup systemd
```

pm2 runs tsx's own entry file. pnpm's `node_modules/.bin/tsx` is a shell script, which pm2 would run as JavaScript. The API reads `~/intented/.env` itself at start.

## Mainnet

The mainnet API is the same code, started with the mainnet settings in its environment. **One catch:** the API also loads `~/intented/.env` (testnet) and fills in every variable that is *unset*. So the mainnet file sets `FACTORY_ACCOUNT_ID`, `ONECLICK_BASE_URL` and `ONECLICK_STANDIN_PUBLIC_KEY` to empty. Left out, `FACTORY_ACCOUNT_ID` would become `intented.testnet`.

`/etc/intented/api-mainnet.env`, root-only:

```sh
NEAR_NETWORK=mainnet
NEAR_AI_MODEL=Qwen/Qwen3.8-27B
NEAR_AI_API_KEY=<from the password manager>
ONECLICK_JWT=<from the password manager>
CONTRACT_ACCOUNT_ID=intented-wallet.near
NEAR_RPC_URL=https://rpc.mainnet.fastnear.com
DATABASE_PATH=/var/lib/intented/mainnet.db
PORT=8788
TRUST_PROXY=1
WEB_ORIGINS=https://intented-near-mainnet.vercel.app
VERDICT_DAILY_CAP=50
FACTORY_ACCOUNT_ID=
ONECLICK_BASE_URL=
ONECLICK_STANDIN_PUBLIC_KEY=
```

```sh
mkdir -p /var/lib/intented        # it started empty on 10 November; William's mainnet database can replace it (stop first, remove -wal and -shm)
cd ~/intented/api
set -a; . /etc/intented/api-mainnet.env; set +a
pm2 start node_modules/tsx/dist/cli.mjs --name intented-api-mainnet -- src/server.ts
pm2 save
```

**nginx:** inside the `hack.furqaannabi.com` server block, before `location /`:

```nginx
location = /mainnet { return 301 /mainnet/; }
location /mainnet/ {
    proxy_pass http://127.0.0.1:8788/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 1M;
}
```

No DNS record or new certificate: it rides on `hack.furqaannabi.com`'s.

## Checks

```sh
pm2 logs intented-api --lines 10 --nostream            # api on :3001, testnet, wallet intented-wallet.testnet, model Qwen/Qwen3.8-27B
pm2 logs intented-api-mainnet --lines 10 --nostream    # api on :8788, mainnet, wallet intented-wallet.near
curl -s https://hack.furqaannabi.com/api/redteam/latest | head -c 120
curl -s https://hack.furqaannabi.com/mainnet/api/proposals | head -c 120
```

From outside, ports 3001 and 8788 must not answer.

**Mandate texts.** Verdicts are refused for a wallet whose mandate text isn't stored. Store it with `POST /api/mandate`, then check that `GET /api/mandates/<hash>` matches the wallet's on-chain `mandate_hash`. On testnet, these are stored as of 10 November:
- `eb43080e…`: `demo`, `demo2`, `retest-1104`, `retest-1105`
- `feab2cb4…`: `intented-wallet.testnet`
- `a9e48e7a…`, `a089a37c…` and `f4f4b1f7…`: `demo-wallet`, `it-1107` and `william-test-1104`

Wallets made from the site store their own.

## Updating

```sh
cd ~/intented && git pull --ff-only
pnpm --dir firewall-core install --frozen-lockfile && pnpm --dir api install --frozen-lockfile
pm2 restart intented-api
set -a; . /etc/intented/api-mainnet.env; set +a; pm2 restart intented-api-mainnet --update-env
```

There's no auto-deploy. The databases stay where they are. To back them up, take an EBS snapshot, or copy the `.db` files while their processes are stopped.
