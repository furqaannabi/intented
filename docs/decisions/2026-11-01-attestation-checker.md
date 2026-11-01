# The attestation checker ports NEAR's verifier and fails closed

2026-11-01 · Decided by Furqaan · Status: accepted

## Context

[The trust model](./2026-11-01-signed-verdict-trust-model.md) puts attestation off-chain: the owner allowlists a signer only after its attestation report checks out. NEAR's official verifier (`nearai-cloud-verifier`, `ts/model_verifier.ts`) runs the right checks but prints several results instead of failing on them (the app-measurement match), and reads NVIDIA's verdict from its token without checking the token's signature.

## Decision

`firewall-core/src/attestation.ts` and `pnpm attest [--register]` check each model TEE in a report fetched with a fresh 32-byte nonce. Every check must pass, or nothing is registered:

1. The report is for our model, echoes our nonce, and signs with `ecdsa`.
2. The TDX quote verifies against Intel's certificate chain and TCB info (collateral from Intel's PCS) with status `UpToDate`. `OutOfDate` is rejected unless explicitly allowed in code.
3. The verified quote's `report_data` is the signing address, zero-padded to 32 bytes, followed by our nonce.
4. The verified quote's `mr_config_id` is `01 ‖ sha256(app_compose) ‖ zeros`, so the attested app manifest is the one measured.
5. The GPU evidence carries our nonce, and NVIDIA NRAS's overall token is ES384, signed by a key in NVIDIA's JWKS, issued by NRAS, for our nonce, unexpired, with an overall result of exactly `true`.

New dependency: `@phala/dcap-qvl-node` 0.3.3 (Intel DCAP quote verification, the library NEAR's verifier uses; about 1.1 MB, no further dependencies, MIT). NVIDIA's token is verified with Node's built-in crypto.

## Not verified

- **Which app.** The checker proves the attested `app_compose` is the measured one and records its sha256; it does not compare it with a known-good image. We have no published reference to pin to.
- **NVIDIA's keys** are trusted as served over TLS from `nras.attestation.nvidia.com`; the `x5c` certificate chains in the JWKS are not checked.
- **The gateway's attestation.** The signatures the wallet accepts are `provider_tee`, made inside the model TEE, so the gateway is not in the signature's trust path.
- **On-chain.** The contract still never sees the quote. It trusts the allowlist the owner writes after this check.

## Consequences

- The README's trust section can list exactly checks 1–5 and the four gaps.
- First run, 2026-11-01: GLM-5.3-flash's model TEE verified (`0x3b753b4406613c5e70ae640508632b600424fa0c`, TDX UpToDate, app compose `5f7ebd85…`) and was registered on `wallet.intented-owner.testnet`.
- A rotated signing key means rerunning `pnpm attest --register`; revoking the old signer is a separate owner call.
- Tests run offline: 32 in `test/attestation.test.ts`, on a real quote with saved Intel collateral and on NVIDIA-style tokens signed with a test key.
