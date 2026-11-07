# One npm package, `intented`: the CLI, the library and the MCP server; the API hosted on EC2

2026-11-07 · Decided by Furqaan · Status: proposed (it bundles William's `agent/` code and takes the API host from his list, so it needs his agreement)

## Context

On 6 November `mcp/` made Intented usable from Claude Code, Cursor and Codex, but only from a clone of this repo, with the API running locally ([record](./2026-11-06-mcp-folder.md)). William proposed an npm client, so a developer can use Intented from their own agent without the repo:

> 1. A CLI through `npx`. A developer on their own machine runs `npx intented init my-agent` …
> 2. A function their agent code imports. `import { pay } from "intented"` … That does propose, then `POST /api/verdict`, then `execute`, and reports what happened.

The code for both already exists in `agent/`: `init.ts`, `pay.ts` and `wallet.ts`. `init.ts` imports `base58` from `api/src/oneclick.ts`, and `wallet.ts` imports the firewall core's `createChainClient`. None of it is published. The npm name `intented` was free on 7 November.

## Decision

- **One package, `intented`**, built from a new `client/` folder that replaces `mcp/`. It is Furqaan's, as `mcp/` was. It has three entry points:
  - the CLI: `npx intented init <name>`, `npx intented pay <wallet> --to … --amount … [--token …] --context …`, and `npx intented mcp` for the MCP server;
  - the library: `import { pay, init } from "intented"`, with `pay({ wallet, to, amount, token?, context })`. The amount is in whole tokens, converted exactly with the firewall core's token table;
  - the MCP server, the same three tools as before.
- **Bundled, not moved.** esbuild bundles `agent/`'s `init`, `pay` and `wallet`, `base58` from `api/`, and the firewall core's chain client and token table straight from their source files. `agent/` is not edited and stays the source. Those three files become a published API, so a change to their signatures is agreed first.
- **Runtime dependencies:** `near-api-js` 7.3.1, `@modelcontextprotocol/sdk` 1.32.1 and `zod` 4.6.7. **Build-only:** esbuild 0.28.2, the version tsx already installs. The judge, the prompt, ethers and the attestation checker stay out of the package.
- **NEAR testnet only** in this version. `pay` refuses any other wallet.
- **Publishing.** Furqaan publishes from his npm account after both owners say yes to the name and the version, having installed the packed tarball in an empty folder and run it. `client/package.json` stays `"private": true` until then, so it can't be published by accident.
- **The API is hosted on AWS EC2**, set up by Furqaan: one Ubuntu instance with an Elastic IP; the API under systemd with SQLite on the instance's EBS volume; Caddy in front for HTTPS; and only ports 22, 80 and 443 open ([the steps](../hosting-ec2.md)). The package's default API and site URLs then point at the hosted ones. This settles "API host (Railway or Render)" on William's list, with his agreement.

## Consequences

- A developer's quickstart is `npx intented init`, one signature on the Create page, and one `pay()` call. A coding agent's is one line of MCP config.
- The package can only be as current as its last publish. A fix in `agent/` reaches users only through a new version.
- A published version can't be taken back. Each version is checked from a packed tarball before it goes out.
- EC2 costs about $15 a month for a `t3.small` and its disk, less on a `t3.micro`. Deploys are by hand (`git pull`, install, restart); nothing reaches the instance automatically.
- The Claude Code plugin's MCP entry becomes `npx -y intented mcp`, so the plugin needs no bundled file in the repo.
