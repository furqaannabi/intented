# The landing page doesn't show the red-team figures

2026-11-01 · Decided by William · Status: accepted. Supersedes the page rows of [this record](./2026-11-01-redteam-published-run.md)

## Context

The landing page showed the red-team counts (27/27 attacks blocked, 0/26 honest payments stopped) in the hero and in the Proof section, fetched from `GET /api/redteam/latest` ([record](./2026-11-01-redteam-published-run.md)). We wrote both the attack cases and the honest ones, so a perfect score measures our test set as much as the model, and it can read as a stronger claim than the evidence supports. The figures also come from the KT3 harness, not from `make redteam` on the real pipeline. And the product's guarantee is the contract (no signed `ALLOW`, no payment; caps the model can't loosen), not the judge's score.

## Decision

- The hero and the Proof section no longer show the red-team counts or the case count. The web app no longer fetches `/api/redteam/latest`.
- Proof keeps the median time to a signed verdict (4.6 s), the two testnet transactions and the attestation line. Its heading drops "Tested".
- `GET /api/redteam/latest`, `redteam/latest.json` and `pnpm publish-run` stay as they are: the endpoint is in the interface spec, and the README must still carry the numbers from `make redteam`.

## Consequences

- The page's claims are what the chain and the published attestation show, plus one latency figure that is still written by hand.
- The [note to Furqaan](../note-to-furqaan-2026-11-01-redteam-fields.md) asking for `model`, `started_at`, `runs_per_case` and `median_ms` loses most of its reason; only the 4.6 s on the page would read from it. It can be withdrawn or kept for the README.
- The web app's `/api/redteam/latest` rewrite in `next.config.ts` stays, unused for now, so a later red-team view needs no config change.
