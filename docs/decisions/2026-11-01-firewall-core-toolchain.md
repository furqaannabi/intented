# firewall-core: TypeScript on Node with pnpm, tsx, vitest and ethers v6

2026-11-01 · Decided by Furqaan · Status: accepted

## Context

The [repo-layout record](./2026-11-01-repo-layout-and-ownership.md) lets each part pick its own toolchain on Day 1–2. The firewall core is a TypeScript library that William's API imports, and it needs EIP-191 signature recovery and tests on its critical paths.

## Decision

| Need | Choice | Instead of |
| --- | --- | --- |
| Package manager | pnpm | npm, bun; pnpm matches `web/` |
| Run TypeScript scripts | tsx | a `tsc` build step |
| Tests | vitest | `node:test`, which has weaker assertions |
| Signature recovery | ethers v6 | viem, @noble/curves; ethers is what NEAR AI's verification example uses |
| `.env` loading | Node's `process.loadEnvFile` | dotenv |

The library is imported from source (`"exports": {".": "./src/index.ts"}`); there is no build yet.

## Consequences

- William's code imports `@intented/firewall-core` and needs a TypeScript-aware runner (tsx or Vite) until a build is added.
- pnpm 11 asks before running any dependency's install script; esbuild's is allowed in `pnpm-workspace.yaml`, because tsx needs it.
