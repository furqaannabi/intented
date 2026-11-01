# contract

The wallet contract, in near-sdk-rs. **Owner: Furqaan.**

It defines `propose`, `execute`, the signer registry, mandate storage, the nonce and expiry replay guard, hard per-transaction and daily caps, the allowlist and the freeze switch. `execute` verifies the NEAR AI signature and checks that the action inside the signed request is byte for byte the action being executed. Methods and checks: [`docs/interface-spec.md`](../docs/interface-spec.md). What it verifies and what it doesn't: [the trust model](../docs/decisions/2026-11-01-signed-verdict-trust-model.md).

**Day 1:** KT2, a minimal testnet contract `verify(req, resp, sig)` run on KT1's real artifacts, plus a function-call key that fails on an out-of-scope call.
