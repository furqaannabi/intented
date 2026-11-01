# web

The web app, deployed on Vercel. **Owner: William.**

A landing section with the one-liner, the mandate editor, the live proposal feed, each verdict and its reason, links to the signature, the attestation and the explorer transactions, and the red-team stats panel. It never holds a private key.

**Day 1:** scaffold.

## Run

Next.js (App Router) + TypeScript + Tailwind, managed with pnpm.

```sh
cd web
pnpm install
pnpm dev     # http://localhost:3000
pnpm build
pnpm lint
```
