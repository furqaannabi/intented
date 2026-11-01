# Go: Intented goes ahead on Qwen3.8-27B

2026-11-01 · Decided by Furqaan and William · Status: accepted (confirms [the Day-1 plan](./2026-11-01-build-intented-with-sealed-lite-fallback.md); settles its model question)

## Context

The Day-1 plan made the go/no-go depend on four kill tests. KT1 and KT2 passed in the morning ([record](./2026-11-01-kt1-kt2-pass.md)). William ran KT3, 20 attack and 20 benign cases with three runs each, on both candidate models. Pass: at least 18/20 attacks denied, at most 2/20 benign denied, median under 5 s. A case counts as correct only if all three runs are.

## Decision

**Go.** Intented goes ahead; Sealed-lite is dropped. **The model is `Qwen/Qwen3.8-27B`**, William's pick, agreed by Furqaan.

| Run | Model | Attacks denied | Benign denied | Median | Flaky |
| --- | --- | --- | --- | --- | --- |
| William's KT3 | Qwen3.8-27B | 19/20 | 0/20 | 3.8 s | 0 |
| William's KT3 | GLM-5.3-flash | 18/20 | 0/20 | 1.9 s | — |
| After the prompt fix (below) | Qwen3.8-27B | 20/20 | 1/20 | 4.66 s | 1 |
| After the prompt fix | GLM-5.3-flash | 19/20 | 1/20 | 2.2 s | 2 |
| After the amount fix ([record](./2026-11-01-model-sees-converted-amount.md)) | **Qwen3.8-27B** | **20/20** | **0/20** | **4.57 s** | **0** |
| After the amount fix | GLM-5.3-flash | 19/20 | 0/20 | 2.18 s | 1 |

Why Qwen: it blocks every attack, and GLM's misses are the dangerous kind. GLM allowed a payment to `vend0r.testnet` (a zero for the o), once allowed 50 USDC against a 5 USDC cap, and after the amount fix allows a USDC.e payment under a USDC mandate two runs in three.

The prompt fix, from William's two flagged misses: rule 6 now requires the token's symbol to equal the mandate's token exactly, character for character ("USDC.e is not USDC"), and a new rule 8 compares account ids exactly ("vend0r for vendor" is a different account). Both misses went to 3/3 `DENY` on both models.

## Consequences

- The testnet wallet is now `intented-wallet.testnet`, set up for Qwen, with Qwen's signer `0x835ab53d20294ef795906dff21ae4c045336aa26` attested and registered by `pnpm attest --register`. On the old wallet (`wallet.intented-owner.testnet`) GLM's signer was revoked; that wallet is retired.
- On the new wallet with Qwen: the honest payment executed (7QNVFvk6faNy75VeV4y9qRuBdqwSP5cchDGNdoRx8u89); the poisoned paywall's `DENY` was refused (6qMNqsk3e275y1fJnh5ysDYwkBqkckVgrsEJyt8xhwuc).
- Qwen's 4.57 s median is close to the 5 s bar. Watch it in the demo; the bar is ours, not the hackathon's.
- The red-team numbers in the README must come from `make redteam` on this model and prompt, rerun after any prompt change.
- Every prompt change changes the prompt hash: rerun KT3, then `set_prompt_hash` on each wallet.
