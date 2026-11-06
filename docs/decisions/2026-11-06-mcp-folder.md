# Intented as an MCP server and a skill, in a new mcp/ folder owned by Furqaan

2026-11-06 · Decided by Furqaan, William · Status: accepted

## Context

Claude Code and Codex are among the judges. A coding agent is also an agent that reads untrusted text (READMEs, issues, web pages, tool output) and can be asked to pay. Furqaan proposed exposing Intented to coding agents as an MCP server, with a Claude Code skill. It wraps code in William's `agent/`: `initAgent`, `loadAgentKey`, `walletAgent` and `pay`. William agreed on 6 November:

> Yes to the MCP in a new mcp/ folder, built by you. First to cut if 10 Nov gets tight.

## Decision

- **A new folder, `mcp/`, owned by Furqaan.** It imports `@intented/agent` through a `link:` dependency and adds no logic to the trust path. Changes to `agent/` that it needs are William's.
- **Three tools over stdio:** `intented_init`, `intented_pay` and `intented_status`. NEAR testnet and wNEAR only.
- **A Claude Code skill** in `mcp/skill/intented/`. It tells the agent to pass what it read as `context` verbatim, and never to retry or reword a payment after a `DENY`. The same text works as a Cursor rule.
- **Dependencies:** `@modelcontextprotocol/sdk` 1.32.1 and `zod` 4.6.7, both pinned to releases more than two weeks old. They replace nothing. The SDK brings 135 packages in all, mostly HTTP transports that a stdio server never loads.

## Consequences

- A judge can point Claude Code, Cursor or Codex at a clone and pay from a testnet wallet. They need the API running and a wallet of their own.
- The coding agent chooses its `context`, so a compromised agent can leave out the injected text. The mandate check on the payment itself and the wallet's caps hold either way. `mcp/README.md` says so.
- It is the first thing cut if the 10 November feature-complete date gets tight.
