# make redteam runs every case through judge(), and a NEAR AI outage stops the run

2026-11-02 · Decided by William · Status: accepted

## Context

CLAUDE.md requires the published red-team numbers to come from `make redteam` on the real pipeline. Until now the runner (the KT3 harness) built the same request as the firewall core, but called NEAR AI itself and never fetched or checked the TEE signature. There was no `make redteam` target. The [published-run record](./2026-11-01-redteam-published-run.md) listed this as still to do.

Running "the real pipeline" all the way would mean proposing and executing every case on-chain. Each honest `ALLOW` would pay real testnet wNEAR, the 0.05 wNEAR daily cap stops it after about five honest payments, and the USDC cases' payees aren't allowlisted.

The first two full runs on 2 November were spoiled by outages: a network drop in one, NEAR AI 502s and timeouts in the other. Their errors were scored as misses (20/27 and 9/27 attacks blocked), and `publish-run` would have accepted them.

## Decision

- **The pipeline:** every run goes through the firewall core's `judge()`, exactly as the API calls it. That covers the prompt and request bytes, the NEAR AI call, the TEE signature fetched straight after the call and checked against the exact request and response, and the parsed verdict. Nothing is written on-chain.
- **The wallet check:** `make redteam` (`pnpm redteam`, i.e. `--wallet`) reads the wallet's `get_config`, judges with its `model_id`, and counts any run whose signer isn't on its allowlist as an error. `pnpm kt3 [model ...]` still compares other models, without that check.
- **The proof:** each run records NEAR AI's `chat_id`, the recovered signer and the 65-byte signature.
- **Outages:** a run with no verdict after three tries (network failure, 5xx, rate limit or timeout) means NEAR AI was unavailable. After three such runs in a row, the runner stops and writes nothing. `publish-run` refuses any run that contains one, and also refuses `--only` smoke runs and runs made without `--wallet`. Errors that are about the judge itself, such as a bad signature or a signer that isn't allowlisted, still count against their case.
- **Progress:** one line per run, plus a line for every retry.

## Consequences

- Published: Qwen/Qwen3.8-27B, started 2026-11-02T11:27:13Z, 53 cases with three runs each, one at a time. 27/27 attacks blocked, 0/26 honest payments stopped, 0 errors, all 159 verdicts signed by the allowlisted `0x835ab53d20294ef795906dff21ae4c045336aa26`. The median time to a signed verdict was 5530 ms (p10 4024, p90 6642).
- That median is over the KT3 bar of 5 s, so the runner reports "KT3 FAIL" for this run. The bar was set on Day 1 for the call alone; the median now includes fetching the signature, and NEAR AI was slower on 2 November. The landing page's latency figure changed from 4.6 s, which was measured without the signature, to 5.5 s.
- A publishable run needs NEAR AI to stay up for about 15 to 20 minutes. If it doesn't, rerun it; the guard keeps an outage from being published.
- The README still has to state these numbers. That's not done in this change.
