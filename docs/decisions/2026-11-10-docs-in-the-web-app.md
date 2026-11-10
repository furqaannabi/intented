# The docs are served at `/docs` in the web app, with Fumadocs, not on Mintlify

2026-11-10 · Decided by William · Status: accepted

Supersedes [the Mintlify record](./2026-11-07-docs-site-on-mintlify.md) on hosting only. What the docs say, and who writes and reviews them, stay as that record has them.

## Context

The docs site in `docs-site/` was written for Mintlify's free plan. On 10 November, when it was to be deployed, the free Mintlify access was used up on both William's and Furqaan's accounts, so hosting it there would need a paid plan.

Four options were weighed:
- **Pay for Mintlify.** Nothing to port, but a paid plan for a fourteen-day hackathon.
- **Plain Markdown on GitHub.** About an hour, no hosting, but no sidebar, search or API reference, and Mintlify's components would show as raw tags.
- **A separate docs site on Vercel.** The same port as below, plus a third site to deploy and keep working until 14 November.
- **`/docs` inside the web app.** The same port, with no new deploy or account. The docs ship with the site that's already hosted.

## Decision

- The pages are served at `/docs` on both web builds, by [Fumadocs](https://fumadocs.dev), an MDX docs framework for Next.js.
- `web/` gains four dependencies, pinned to the 23 October releases, more than two weeks old on the day: `fumadocs-core` and `fumadocs-ui` 16.17.8, `fumadocs-mdx` 15.4.10 and `fumadocs-openapi` 12.5.5. The OpenAPI pages are served without the optional interactive playground.
- The pages move from `docs-site/` to `web/content/docs/`, because the web build can't compile files outside `web/`. Internal links gain the `/docs` prefix. Mintlify's components (`<Note>`, `<Warning>`, `<Steps>`, `<Card>`, `<CodeGroup>`) map onto Fumadocs' in one file, so the pages keep their text. `docs.json` is replaced by `meta.json` files with the same order.
- Hosting stays as it is: the docs go live when the `web` project is redeployed.

## Consequences

- No third site, and no account to keep. The docs update with every `web` deploy, and only then.
- The `web` build compiles 18 more pages and installs a few MB more. A Fumadocs break could break the `web` build, so `pnpm build` in `web/` has to pass before a deploy.
- `mint validate` and `mint broken-links` no longer apply. The web build fails on a page that doesn't compile; it doesn't check links or that a page is true.
- The mainnet site serves the same docs, which describe testnet. Their pages already say so.
