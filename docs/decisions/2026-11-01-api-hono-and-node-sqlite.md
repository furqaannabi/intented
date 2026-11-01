# api: Hono on Node, with node:sqlite for storage

2026-11-01 · Decided by William · Status: accepted

## Context

The [build plan](../Intented%20hackathon%20plan.pdf) leaves the API framework (Hono or Express) and the host (Railway or Render) to William. The API serves the endpoints in the [interface spec](../interface-spec.md), calls the firewall core, and stores proposals, verdicts and the raw request and response bytes in SQLite. The rest of the TypeScript in the repo uses `fetch` with web-standard `Request` and `Response`, and runs on Node 24 with tsx.

## Decision

| Need | Choice | Instead of |
| --- | --- | --- |
| HTTP framework | Hono, served on Node by `@hono/node-server` | Express 5; Hono is TypeScript-first, uses the same `Request`/`Response` as the rest of the code, and adds two packages with almost no dependencies of their own |
| SQLite | `node:sqlite`, built into Node 24 | better-sqlite3, a native module compiled at install time that needs a build approval in pnpm and can fail on a deploy host |

The host stays open until deployment on Day 9.

## Consequences

- Two new dependencies: `hono` and `@hono/node-server`. Nothing to compile on install.
- Node's documentation still marks `node:sqlite` as under active development, so its API may change in a later Node release. The API pins Node 24 (`engines`), and storage code stays behind one module so a switch to better-sqlite3 touches one file.
- The host must run Node 24 or later.
