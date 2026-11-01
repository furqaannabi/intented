# The trust model: attestation checked off-chain, signer allowlisted on-chain, the contract's caps as the backstop

2026-11-01 · Decided by Furqaan and William (build plan §2) · Status: accepted

## Context

Intented asks a model to judge each action, then lets a contract act on that judgment. Judges will read the README and the code for exactly what is verified where. Overstating it would be the fastest way to lose the security track's trust. The firewall model can itself be prompt-injected by the data it reads.

## Decision

- **Attestation is verified off-chain.** The attestation checker calls `/v1/attestation/report` with a fresh nonce, verifies the report, and only then does the owner register the TEE signing address with `register_signer`. The contract checks signatures against that allowlist. **We never claim the contract verifies the TDX quote.**
- **The contract verifies every verdict.** It recovers the signer from `sha256(req):sha256(resp)`, checks the verdict is `ALLOW`, and checks that the action inside the signed request is byte for byte the action being executed.
- **The contract's caps are the backstop.** Per-transaction and daily caps, the allowlist and the freeze switch stay in the contract. The model can only tighten what the contract permits, never loosen it.
- **Untrusted data is quoted as data.** Paywall responses and other tool output go into the prompt as quoted data, the verdict is structured JSON output, and the red-team fixtures include attacks on the firewall itself.
- **NEAR-hosted open models only** until we confirm a proprietary model returns TEE signatures.

## Consequences

- The README states these assumptions plainly, in a "trust assumptions" section.
- A rotated signing key means re-running the attestation checker and `register_signer`; signatures are fetched straight after each call.
- If KT2 fails, a relayer with its own key verifies off-chain, and that weaker assumption is stated in the README too.
