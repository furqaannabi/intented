# No OutLayer integration this hackathon

2026-11-06 · Decided by Furqaan · Status: accepted

## Context

The build plan made an OutLayer integration optional: on 10 November, "only if Discord Q3 says yes", and first on the cut list. Q3 asked whether OutLayer has an API for multisig approvals so a bot can sign, or a co-signer or webhook hook, and whether `request_execution` can call out over HTTPS. It was never answered. OutLayer's own docs say it has "no external co-signer or webhook mechanisms", and its testnet returned 503 for Intents when we researched it ([idea selection](../NEAR%20hackathon%20idea%20selection.md)). Intented's own wallet contract already does what the integration would have shown: it executes only on a signed `ALLOW`, within its caps.

## Decision

No OutLayer integration. Discord Q3 is closed as not needed. The 10 November slot goes to feature-complete on testnet, mainnet preparation and, if agreed, the MCP server and skill ([phase 2](../phase-2.md)).

## Consequences

- One item fewer on the cut list. The rest of it is unchanged: the mandate editor UI, then the daily cap, then the cross-chain leg (keeping the NEAR-native payment). The attack demo is never cut.
- The README and pitch compare Intented with OutLayer as before: OutLayer checks rules such as limits and allowlists; Intented also checks what an action means against the owner's mandate. That comparison quotes OutLayer's docs and makes no claim about an integration.
