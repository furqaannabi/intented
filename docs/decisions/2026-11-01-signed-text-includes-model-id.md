# The signed text includes the model id; signatures are ECDSA through env::ecrecover

2026-11-01 · Proposed by Furqaan · Status: proposed, awaiting William (the interface spec changes only with both owners)

## Context

The [interface spec](../interface-spec.md) and the [trust-model record](./2026-11-01-signed-verdict-trust-model.md) say the contract recovers the signer from `sha256(req) + ":" + sha256(resp)`. The spec left the signature scheme open until KT2.

KT1 showed what NEAR AI Cloud actually signs. A non-streaming completion gets a `provider_tee` signature, made inside the model's TEE, over `{model_id}:{sha256_hex(request)}:{sha256_hex(response)}`. The two-part form, `{sha256_hex(request)}:{sha256_hex(response)}`, is the `gateway` signature, which the gateway makes when it rewrites bytes, for example on a stream. NEAR AI's verification example handles both.

## Decision

- **Signature scheme: ECDSA, EIP-191 personal_sign, recovered with `env::ecrecover`.** KT2 verified it on testnet. This closes the open row in `decisions/README.md`.
- **Check 2 of `execute` becomes:** `{model_id}:{sha256_hex(req)}:{sha256_hex(resp)}` recovers an allowlisted signer, where `model_id` is set by the owner in the contract. Only `provider_tee` signatures are accepted; the firewall core never streams.
- **The contract stores the model id** next to the signer allowlist, and the owner can change it when the model changes.

## Consequences

- The interface spec gets a revision row for check 2, and the glossary's "Signature" entry changes to match. Neither is edited until William agrees.
- The trust-model record's sentence on what is recovered is amended by this record, not edited.
- The model id is signed inside the TEE, so a signature from one model cannot pass as another's.
- Changing model means `register_signer` for the new address and setting the new model id.
