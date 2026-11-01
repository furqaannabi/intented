# Build Intented, with Sealed-lite as the fallback, decided by four kill tests on Day 1

2026-11-01 · Decided by Furqaan and William (build plan, October 2026) · Status: accepted

## Context

Ten ideas were weighed for the NEAR Hackathon (1–14 November 2026); the evidence is in [`NEAR hackathon idea selection.md`](../NEAR%20hackathon%20idea%20selection.md) and [`research_notes/`](../research_notes/). Six of the ten were on Illia's 3 October idea list, so those tracks will be crowded. Intented was not. It matches the AI Security track's hints ("agent security, function call keys, TEE attestation") and uses only documented, working APIs: NEAR AI Cloud signs every response, and a NEAR contract can check that with `sha256` and `ecrecover`. Existing tools such as OutLayer check rules (limits, allowlists); none checks the meaning of an action against what the owner intended.

Both top ideas depend on one untested step: verifying a real NEAR AI signature inside a NEAR contract.

## Decision

Build **Intented**: an agent's wallet contract executes an action only when it carries a TEE-signed `ALLOW` verdict, judged against the owner's plain-English mandate and verified on-chain.

Day 1 runs four kill tests (plan §6): KT1 a signed verdict that recovers locally, KT2 the same verified in a testnet contract, KT3 model quality on 20 attack and 20 benign cases, KT4 a real 1Click payment to Base. At the end of 1 November:

- KT1, KT2 and KT3 pass: commit to Intented and stop evaluating other ideas.
- KT2 fails: keep Intented with a relayer that holds its own allowlisted key, and say so in the README.
- KT3 fails twice: switch to **Sealed-lite**, a commit-reveal prediction-market escrow with 1Click funding and the same signed-verdict verifier as the resolver.

## Consequences

- Nothing beyond the kill tests and scaffolding is built until the evening go/no-go.
- The feed and receipt views carry over to Sealed-lite, so William's Day-1 UI work is not wasted either way.
- The result of the go/no-go gets its own record, which supersedes or confirms this one.
