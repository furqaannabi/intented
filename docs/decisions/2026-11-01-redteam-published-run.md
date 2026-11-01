# The red-team endpoint serves one committed run, in the spec's shape, and the page hides figures it can't fetch

2026-11-01 · Decided by William · Status: accepted

## Context

The [interface spec](../interface-spec.md) lists `GET /api/redteam/latest` as `{ attacks_blocked, attacks_total, benign_denied, benign_total, cases[] }`. The landing page showed the KT3 figures (27/27 attacks blocked, 0/26 honest payments stopped, 4.6 s median) as written text. CLAUDE.md requires the published numbers to come from the red-team runner, not from hand-written copy.

The runner writes each run to `redteam/results/`, which is gitignored. That folder also holds runs on other models (GLM-5.3-flash) and older runs on Qwen. The page also states facts the spec's response doesn't carry: the model, the date, the runs per case and the median latency.

## Decision

| Question | Choice | Instead of |
| --- | --- | --- |
| What the endpoint serves | `redteam/latest.json`, a committed copy of one run chosen by hand with `pnpm publish-run results/<run>.json`. The script recounts the run from its cases and refuses a file whose totals don't match | The newest file in `results/`, which exists only where the runner ran and would replace the published numbers on any rerun, including runs on other models. Or storing runs in SQLite, which needs a new write endpoint and its auth |
| When it's read | On every request, so publishing a run needs no restart. 404 when nothing is published | Read once at start-up |
| The response | The spec's five fields only. The file keeps the rest of the run (model, `started_at`, `runs_per_case`, `median_ms` and so on), but the API doesn't serve it until the spec says so | Serving the whole file, which would widen the spec without Furqaan's agreement |
| How the page gets the counts | Fetched on the server inside `"use cache"` with `cacheLife("minutes")`, so they are in the prerendered HTML | A fetch in the browser after load, which makes the numbers pop in and needs JavaScript |
| When the API can't be reached | The counts and the case count are left out; the rest of the page renders | Falling back to written numbers, which could disagree with the published run |

First run published: Qwen/Qwen3.8-27B, started 2026-11-01T15:11:53Z, 53 cases with three runs each: 27/27 attacks blocked, 0/26 benign denied.

## Consequences

- Publishing new numbers is a deliberate step and shows up in a commit, so a reader can see which run the page and the README claim.
- The model, date, runs per case and 4.6 s median on the page are still written by hand. A note to Furqaan ([note](../note-to-furqaan-2026-11-01-redteam-fields.md)) proposes adding them to the response. Until both owners agree and the spec has a revision row, they stay as copy and must be updated by hand whenever a new run is published.
- **Watch:** the published run comes from the KT3 runner, which calls NEAR AI directly with the firewall core's prompt and parser rather than through `judge()`, and there is no `make redteam` target yet. CLAUDE.md requires the README's numbers to come from `make redteam` on the real pipeline. Moving the runner onto `judge()`, adding the target and publishing a run from it is still to do, before the README states these numbers.
- Wherever the web app is hosted, the build needs `API_URL` to reach the API, or the first prerender leaves the counts out until the cache refreshes.
