# A docs site for developers in `docs-site/`, on Mintlify

2026-11-07 · Decided by Furqaan, William · Status: accepted

## Context

From the `intented` npm package ([record](./2026-11-07-npm-package-intented.md)), a developer uses Intented from their own agent without cloning the repo. The README is written for judges and for running the repo; it doesn't tell a developer how to pay from their code, what each refusal means, or what the HTTP API takes. Furqaan proposed a Mintlify docs site; William agreed on 7 November, to build it the same day.

## Decision

- The site lives in `docs-site/`, as Mintlify MDX pages, `docs.json` and an OpenAPI file for the HTTP API (`openapi.yaml`, written from the interface spec and the API's code).
- William writes it. Furqaan reviews the pages in his lane: the contract and refusal references, the trust model, the CLI and library guides.
- It states no more than the README and the code: the same trust model, the same red-team numbers, the same "not done yet" notes. Where the hosted API or the published package isn't up yet, the page says so.
- Hosting is Mintlify's free plan, connected to this repo with `docs-site` as the subdirectory. The account and the GitHub connection are made by a person, not by an agent.

## Consequences

- Two places say how Intented works. When the README, the spec or a refusal message changes, the matching page changes in the same commit.
- `mint validate` and `mint broken-links` check the site; neither checks that a page is true.
- The API reference's server is `http://localhost:8787` until the API is hosted (9 November); then it and the package pages change to the hosted URLs.
