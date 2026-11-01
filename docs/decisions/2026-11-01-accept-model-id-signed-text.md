# Accepted: the signed text includes the model id; signatures are ECDSA through env::ecrecover

2026-11-01 · Decided by Furqaan and William · Status: accepted (accepts [the proposal](./2026-11-01-signed-text-includes-model-id.md), which stays as written)

## Context

Furqaan proposed that check 2 of `execute` rebuild NEAR AI's actual signed text, `{model_id}:{sha256(req)}:{sha256(resp)}`, instead of the interface spec's `sha256(req):sha256(resp)`, with the model id stored in the contract. KT1 showed the model-id form on both candidate models; KT2 and the testnet wallet verify it on-chain.

## Decision

William agreed on 1 November. The interface spec changes accordingly: check 2 uses the model-id form, the signature scheme is ECDSA (EIP-191) recovered with `env::ecrecover`, and the open item on the signature scheme is closed.

## Consequences

- The spec gains a revision row; the glossary's "Signature" entry gives the model-id form.
- Gateway-form signatures (`{sha256(req)}:{sha256(resp)}`) are not accepted by the wallet.
- The other two proposals of the day ([execute checks the signed request](./2026-11-01-execute-checks-the-signed-request.md), [the seam as factories](./2026-11-01-firewall-core-seam-and-near-api-js.md)) and [the converted amount](./2026-11-01-model-sees-converted-amount.md) still await William.
