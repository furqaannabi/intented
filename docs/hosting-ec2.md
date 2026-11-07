# Hosting the API on EC2 (testnet)

How the Intented API (`api/`) runs on an AWS EC2 instance for testnet, so the `intented` package, the MCP server and the site have an API to call. Decision: [the record](./decisions/2026-11-07-npm-package-intented.md). The mainnet API can run on the same instance as a second service, with its own settings ([runbook](./mainnet-runbook.md), section 0).

**No secret goes in this repo or in this file.** The NEAR AI key is copied from the shared password manager into a root-only file on the instance. The instance needs no AWS credentials and no NEAR key.

## The instance

| Setting | Value |
| --- | --- |
| AMI | Ubuntu Server 24.04 LTS, 64-bit |
| Type | `t3.small` (2 GB). `t3.micro` (1 GB, free-tier eligible) works, but `pnpm install` is slow on it |
| Storage | 20 GB gp3 EBS. It survives reboots, so SQLite needs nothing extra |
| Elastic IP | yes, so the address and the DNS record don't change on a stop and start |
| Security group | inbound 22 from your own IP only, 80 and 443 from anywhere. **Not 8787**: the API listens on every interface, so only the proxy may reach it |
| Key pair | yours, kept outside the repo |

**HTTPS** needs a hostname. Point an A record, e.g. `api.<your domain>`, at the Elastic IP. Without a domain, `<ip with dashes>.sslip.io` resolves to the IP and can get a certificate too. Caddy below gets and renews the certificate itself.

## Set up (once, over SSH)

```sh
# Node 24 and pnpm 11
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git caddy
sudo corepack enable && sudo corepack prepare pnpm@11.9.0 --activate
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# A user with no login shell runs the API; its data lives in /var/lib/intented
sudo useradd --system --home /opt/intented --shell /usr/sbin/nologin intented
sudo git clone https://github.com/furqaannabi/intented.git /opt/intented
sudo mkdir -p /var/lib/intented /etc/intented
sudo chown -R intented:intented /opt/intented /var/lib/intented
sudo -u intented COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --dir /opt/intented/firewall-core install --frozen-lockfile
sudo -u intented COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --dir /opt/intented/api install --frozen-lockfile
```

Installing Caddy from Ubuntu's own package is fine. Caddy's apt repository has newer releases, if needed.

## Settings: `/etc/intented/api-testnet.env`

Root-owned, mode `600`. Names as in [`.env.example`](../.env.example):

```sh
NEAR_NETWORK=testnet
NEAR_AI_MODEL=Qwen/Qwen3.8-27B
NEAR_AI_API_KEY=<from the password manager>
CONTRACT_ACCOUNT_ID=intented-wallet.testnet
FACTORY_ACCOUNT_ID=intented.testnet
DATABASE_PATH=/var/lib/intented/testnet.db
PORT=8787
TRUST_PROXY=1
WEB_ORIGINS=https://intented-near.vercel.app
VERDICT_DAILY_CAP=200
# Only with a hosted 1Click stand-in (below); without them, Base payments get 501:
# ONECLICK_BASE_URL=http://127.0.0.1:8403
# ONECLICK_STANDIN_PUBLIC_KEY=<the stand-in's public key>
```

```sh
sudo chmod 600 /etc/intented/api-testnet.env && sudo chown root:root /etc/intented/api-testnet.env
```

## The service: `/etc/systemd/system/intented-api-testnet.service`

```ini
[Unit]
Description=Intented API (testnet)
After=network-online.target
Wants=network-online.target

[Service]
User=intented
WorkingDirectory=/opt/intented/api
EnvironmentFile=/etc/intented/api-testnet.env
# tsx directly, as `pnpm start` does: pnpm through corepack would try to write to the read-only home at start
ExecStart=/opt/intented/api/node_modules/.bin/tsx src/server.ts
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/intented
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload && sudo systemctl enable --now intented-api-testnet
journalctl -u intented-api-testnet -f    # expect: api on :8787, testnet, wallet intented-wallet.testnet, model Qwen/Qwen3.8-27B
```

## HTTPS: `/etc/caddy/Caddyfile`

```
api.<your domain> {
	reverse_proxy 127.0.0.1:8787
}
```

```sh
sudo systemctl reload caddy
```

Caddy sets `X-Forwarded-For`, which `TRUST_PROXY=1` reads for the rate limits.

## After the first start

1. **Check it answers:**
   - `curl https://api.<your domain>/api/redteam/latest` returns the red-team numbers;
   - `curl https://api.<your domain>/api/proposals` returns `[]`;
   - `curl http://<elastic ip>:8787/` from outside times out, because the security group closes 8787.
2. **Store the mandate texts.** Verdicts are refused for a wallet whose text isn't stored. Store each live wallet's text with `POST /api/mandate {"text": …}`, then check that `GET /api/mandates/<hash>` returns it and that the hash equals the wallet's on-chain `mandate_hash`. On 6 November these were:
   - `feab2cb4…` for `intented-wallet.testnet`;
   - `eb43080e…` for `demo`, `demo2` and `retest-1104`.

   Wallets made from the hosted Create page store their own.
3. **Point the clients at it:**
   - the site's `API_URL` on Vercel;
   - the `intented` package's default API URL (in `client/src/index.ts`), in the next published version;
   - meanwhile, `INTENTED_API_URL` for anyone using the package.
4. **Run one honest payment and the attack** against it with the package's `pay`. Check that both receipts show on the site.

## Updating

```sh
cd /opt/intented && sudo -u intented git pull --ff-only
sudo -u intented COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --dir firewall-core install --frozen-lockfile
sudo -u intented COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --dir api install --frozen-lockfile
sudo systemctl restart intented-api-testnet
```

There's no auto-deploy: `main` reaches the instance only when someone runs this. The SQLite file stays where it is. For a backup, take an EBS snapshot or copy `/var/lib/intented/testnet.db` while the service is stopped.

## The 1Click stand-in (optional)

The Base payments on testnet need `agent/`'s stand-in, `pnpm oneclick`, as a second systemd service on the same instance:
- listening on `127.0.0.1:8403`, never opened in the security group;
- `ONECLICK_STANDIN_KEY` and `ONECLICK_STANDIN_DEPOSIT` in its own root-only env file;
- `agent/`'s dependencies installed.

Then set the two commented settings above and restart the API. Without it, everything but the Base payments works.

## What the instance holds

- **Secrets:** the NEAR AI key, in a root-only file. **No NEAR key**, and no AWS credentials.
- **Data:** proposals, verdicts, mandate texts and quotes, in SQLite under `/var/lib/intented`. All of it is public anyway through `GET /api/proposals` and `GET /api/mandates/:hash`.
- **Logs:** in the journal; proposal ids, statuses and transaction hashes, never keys or prompts.
