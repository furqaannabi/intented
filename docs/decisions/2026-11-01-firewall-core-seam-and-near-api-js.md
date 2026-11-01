# The firewall core's seam is real; on-chain calls use near-api-js 7.3.1

2026-11-01 · Decided by Furqaan · Status: accepted

## Context

[The seam record](./2026-11-01-firewall-core-interface-is-the-seam.md) has William's API call a stub of `judge`, `proposeOnChain` and `executeOnChain` until Day 6. The two on-chain functions need to sign transactions with the agent's function-call key. The options were `near-api-js`, the split `@near-js/*` packages, or hand-built borsh transactions.

## Decision

- **`near-api-js`, pinned to 7.3.1** (August 2026). 7.4.0 was nine days old; we take a release at least two weeks old. About 2.7 MB with `@noble/*`, `@scure/base` and `borsh`. Only the server-side core imports it.
- **The seam ships as factories**, so configuration and keys stay out of each call:
  - `createJudge({ apiKey, model, network })` returns `judge(mandate_text, action, args_json, context)`, which builds the request, calls NEAR AI, fetches the signature straight after, checks that the signed text covers the exact bytes and recovers to the stated signer, and parses the verdict (anything malformed is a `DENY`).
  - `createChainClient({ rpcUrl, walletId, agentId, agentPrivateKey })` returns `proposeOnChain(action, args_json)` and `executeOnChain(proposal_id, req_bytes, resp_bytes, signature)`.
- **`executeOnChain` reports `ok` only if every receipt succeeded.** The wallet's callback succeeds even when the proposed call fails, so the top-level status is not enough. A refused call still returns its transaction hash.

## Consequences

- The real core is available on Day 1 instead of Day 6; William can skip the stub or keep it for UI work without NEAR AI calls.
- Both demo paths ran through the core alone on testnet: honest `ALLOW` executed (proposal 3), poisoned `DENY` refused with hash 3y5NX63eHCap5Dpmye9TyBd5uj46KrxRB1Jh2dFAEAMT (proposal 4).
- The interface spec's shapes are unchanged; the factories are how they are configured. Pending William's agreement as a spec revision row.
