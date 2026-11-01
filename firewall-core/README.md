# firewall-core

The firewall core library, in TypeScript, and the attestation checker. **Owner: Furqaan.**

- **Firewall core:** the canonical encoder; the prompt built from the mandate and the action, with untrusted data quoted; the call to NEAR AI `/v1/chat/completions` with structured JSON output; the signature fetched from `/v1/signature/{id}` straight after; submitting `propose` and `execute` to the contract. Exposes `judge`, `proposeOnChain` and `executeOnChain`, the seam William's API imports ([`docs/interface-spec.md`](../docs/interface-spec.md)).
- **Attestation checker:** a script that calls `/v1/attestation/report` with a fresh nonce, verifies it off-chain, and registers the TEE signing address in the contract (owner only).

**Day 1:** KT1, a real signed verdict whose signature recovers to the signing address locally, and an attestation report that echoes our nonce. Supply the KT3 prompt.
