# Accepted: execute checks the signed request, the seam as factories, converted amounts, the owner setters and updated_at

2026-11-01 · Decided by Furqaan and William · Status: accepted (accepts the records below, which stay as written)

## Context

Five changes to the interface spec were open at the end of 1 November. Four came from Furqaan, one from William:

1. [`execute` checks what the signed request asked](./2026-11-01-execute-checks-the-signed-request.md), with `set_prompt_hash`, `set_model_id`, and `model_id` at init.
2. [The seam ships as factories](./2026-11-01-firewall-core-seam-and-near-api-js.md): `createJudge` and `createChainClient`.
3. [The model sees converted amounts](./2026-11-01-model-sees-converted-amount.md), with `set_token` replacing `set_token_caps`.
4. The owner setters in [the wallet caps record](./2026-11-01-wallet-caps-window-allowlist.md): `allow_receiver`, `disallow_receiver`, `set_near_caps`, and `revoke_signer` taking an address.
5. `updated_at` on `Proposal`, from [the API pipeline record](./2026-11-01-api-pipeline-behaviour.md).

## Decision

All five are accepted and in the interface spec as one revision. William said yes to 1–3 on 1 November. Furqaan included 4 on the strength of that yes, since 1 and 3 depend on those setters; William can object, and a new record would follow. Furqaan agreed to 5.

## Consequences

- The spec now matches the deployed wallet (`intented-wallet.testnet`) and the firewall core on `main`.
- The API returns `updated_at` and can filter `?since=` on it.
- `attestation_url` points at `docs/attestations/<signer>.json`, written by `pnpm attest --register`.
- The open spec question is the cross-chain payee: a 1Click deposit address is not the vendor, so the judge would need the quote's real recipient as trusted data.
