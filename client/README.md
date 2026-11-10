# intented

Pay from an Intented wallet on NEAR. The wallet pays only when a model in a TEE on NEAR AI Cloud has judged the payment against the owner's plain-English rules and signed `ALLOW`, and only within the wallet's caps. On a `DENY` the wallet refuses on chain and nothing moves. **NEAR testnet only, for now.**

On npm as [`intented`](https://www.npmjs.com/package/intented) (0.1.0, 10 November). It uses the hosted testnet API and site by default ([Settings](#settings)).

This package is the client side: it makes the agent's key, and it pays.
- **A command:** `npx intented`.
- **A library:** `import { pay } from "intented"`.
- **An MCP server**, so Claude Code, Cursor or Codex can pay.

Needs Node 22.22 or later, the version `near-api-js` needs. Checked on Node 22.23 and 24.19.

The rules, the verdict and the caps are enforced by the wallet contract and the Intented API, not by this package. Source: [`client/`](https://github.com/furqaannabi/intented/tree/main/client) in the Intented repo. **Owner: Furqaan.** Why it is built this way: [the record](https://github.com/furqaannabi/intented/blob/main/docs/decisions/2026-11-07-npm-package-intented.md).

## Quickstart

```sh
npx intented init my-agent
```

This makes the agent's key for `my-agent.intented.testnet` on your machine and prints a link. The private key stays in `~/.intented/testnet/`, readable by you only, and is never printed.

1. Open the link, connect a NEAR testnet wallet, write the rules your agent must follow, set its limits, and sign. The factory makes the wallet with the agent's key, which can only call `propose` and `execute`.
2. Fund the wallet with a little testnet wNEAR or USDC.
3. Pay from your agent's code:

```ts
import { pay } from "intented";

const r = await pay({
  wallet: "my-agent.intented.testnet",
  to: "intented-vendor.testnet",
  amount: "0.001",            // whole tokens
  token: "wrap.testnet",      // wNEAR; the default
  context: what402Said,       // what your agent read that asked for this payment, verbatim
});
// r.outcome: "paid" | "denied" | "failed" | "no verdict"
```

Or from the shell:

```sh
npx intented pay my-agent --to intented-vendor.testnet --amount 0.001 --context "HTTP 402: market data costs 0.001 wNEAR"
```

`pay` proposes the payment with the agent's key, asks the Intented API for the signed verdict on exactly that proposal, and hands the verdict to the wallet. A `DENY` is handed over too, so the wallet's refusal is on chain as the record. The command exits 0 only when the payment was made.

**Tokens** are the ones the firewall knows on testnet: wNEAR (`wrap.testnet`), USDC (`3e2210e1…b8af`) and USDC.e (`usdc.fakes.testnet`). Any other token is refused before anything is proposed. Amounts are converted exactly to each token's decimals.

## From Claude Code, Cursor or Codex

The MCP server has three tools:
- `intented_init(name)`
- `intented_pay(name, to, amount, context)`: wNEAR
- `intented_status(name)`: the wallet's rules, its caps, and its last payments

**Claude Code:**

```sh
claude mcp add --transport stdio intented -- npx -y intented mcp
```

**Cursor**, in `.cursor/mcp.json`:

```json
{ "mcpServers": { "intented": { "command": "npx", "args": ["-y", "intented", "mcp"] } } }
```

**Codex**, in `~/.codex/config.toml`:

```toml
[mcp_servers.intented]
command = "npx"
args = ["-y", "intented", "mcp"]
```

**The skill.** `skill/intented/SKILL.md` (in the package, and in the repo) tells Claude Code how to use the tools:
- read the rules first;
- pass what it read as `context`, verbatim;
- after a `DENY`, never retry or reword the payment.

Copy the `skill/intented` folder into `.claude/skills/` or `~/.claude/skills/`. In Cursor, the same text works as a rule.

## Settings

Environment variables, all optional:

| Name | Default |
| --- | --- |
| `INTENTED_API_URL` | `https://hack.furqaannabi.com`, the hosted testnet API |
| `INTENTED_WEB_URL` | `https://intented-near.vercel.app`, for the Create link |
| `INTENTED_HOME` | `~/.intented`, where keys are kept |
| `NEAR_RPC_URL` | `https://test.rpc.fastnear.com` |

`pay` also takes `apiUrl`, `rpcUrl` and `home` per call, and `onStep` to follow each step.

## What it can't stop

- **Your agent chooses what it passes as `context`.** A compromised agent can leave out the injected text. The judge still checks the payment itself (payee, token, amount) against the owner's rules, and the wallet's caps still bound what one wrong `ALLOW` can cost.
- **The client decides whether a person approves each MCP call.** Claude Code asks before each MCP tool call unless the tool is allowed. Intented doesn't rely on that prompt: the wallet's check and caps hold either way.
- **The model can be wrong.** That is why the caps are in the contract, not in the prompt.

## Develop

```sh
pnpm install
pnpm test        # 18 tests: the library and the MCP tools, with the chain and the API faked
pnpm typecheck   # also checks types/index.d.ts against the implementation
pnpm build       # dist/: bundles agent/'s init, pay and wallet and the firewall core's chain client and token table
npm pack         # the tarball, to install in an empty folder and run before publishing
```
