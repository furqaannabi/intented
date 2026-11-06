# mcp

Intented as an MCP server, so a coding agent such as Claude Code, Cursor or Codex can pay from an Intented wallet. **Owner: Furqaan.** Why it exists and why it is built this way: [the record](../docs/decisions/2026-11-06-mcp-folder.md).

A coding agent reads READMEs, issues, web pages and tool output, and any of them can carry a prompt injection. With this server, a payment the agent makes goes through the same check as every Intented payment: a model in a TEE on NEAR AI Cloud judges it against the owner's plain-English rules and signs its verdict, and the wallet contract pays only on a signed `ALLOW` within its caps. On a `DENY` the wallet refuses on chain and nothing moves.

It is a thin layer over the demo agent's code in [`agent/`](../agent/README.md): `initAgent`, `loadAgentKey`, `walletAgent` and `pay`. It adds no logic to the trust path. **NEAR testnet and wNEAR only, for now.**

## Tools

| Tool | What it does |
| --- | --- |
| `intented_init(name)` | Makes the agent's key for `<name>.intented.testnet` on this machine, saved in `~/.intented/testnet/` and readable by this user only. Returns the public key and a link to the Create page; the owner opens it, writes the rules and signs. Running it again returns the same key |
| `intented_pay(name, to, amount, context)` | Proposes `amount` wNEAR to `to` on the wallet, asks the Intented API for the signed verdict on exactly that proposal, and hands it to the wallet. `context` is what the agent read that asked for the payment, verbatim; the judge reads it as data. On `DENY` it says the wallet refused it, nothing moved, and not to retry or reword it |
| `intented_status(name)` | Read-only: whether the wallet is frozen, its wNEAR caps, the owner's rules, and its last five payments with their verdicts |

No tool returns a private key. A test checks this.

## Set up

Needs Node 24 and pnpm 11, a clone of this repo, and the Intented API (`api/`) running somewhere the agent can reach.

```sh
cd mcp && pnpm install
```

**Claude Code:**

```sh
claude mcp add --transport stdio intented -- pnpm --dir /path/to/intented/mcp start
```

**Cursor:** in `.cursor/mcp.json`:

```json
{ "mcpServers": { "intented": { "command": "pnpm", "args": ["--dir", "/path/to/intented/mcp", "start"] } } }
```

**Codex:** in `~/.codex/config.toml`:

```toml
[mcp_servers.intented]
command = "pnpm"
args = ["--dir", "/path/to/intented/mcp", "start"]
```

Then ask the agent to run `intented_init` with a name. Open the link it returns, write the rules, sign `create` and fund the wallet with a little testnet wNEAR.

**Settings** (environment, all optional):

| Name | Default |
| --- | --- |
| `INTENTED_API_URL` | `http://localhost:8787` |
| `INTENTED_WEB_URL` | `http://localhost:3000`, for the Create link |
| `INTENTED_HOME` | `~/.intented`, where keys are kept |
| `NEAR_RPC_URL` | testnet's public RPC |

**The skill:** [`skill/intented/SKILL.md`](./skill/intented/SKILL.md) tells Claude Code how to use the tools: what to pass as `context`, to read the rules first, and what to do after a `DENY`. Copy the `skill/intented` folder into `.claude/skills/` in your project, or into `~/.claude/skills/`. In Cursor, the same text works as a rule in `.cursor/rules/`.

## What it can't stop

- **The coding agent chooses what it passes as `context`.** A compromised agent can leave out the injected text. The judge still checks the payment itself (payee, token, amount) against the owner's rules, and the wallet's caps still bound what one wrong `ALLOW` can cost.
- **The client decides whether a person approves each call.** Claude Code asks before each MCP tool call unless you allow the tool (`mcp__intented__intented_pay`) or run in a mode that doesn't ask. Intented doesn't rely on that prompt: the wallet's check and caps hold whether or not a person approved the call.
- **It runs from a clone.** Nothing is published to npm.

## Test

```sh
pnpm test        # the three tools, with the chain and the API faked
pnpm typecheck
```
