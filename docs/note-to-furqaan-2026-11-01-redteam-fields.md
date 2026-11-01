# Note to Furqaan: four more fields on `GET /api/redteam/latest`

From William, 1 November. This is a proposed spec change, not built yet. Nothing in your folders changes; it only needs your yes.

## Where things stand

`GET /api/redteam/latest` is live in `api/`. It serves the committed run in `redteam/latest.json` with exactly the spec's fields: `{ attacks_blocked, attacks_total, benign_denied, benign_total, cases[] }`. The landing page takes its counts from it. Why it works this way: [record](./decisions/2026-11-01-redteam-published-run.md).

The page also states four facts that the response doesn't carry, so they are still written by hand: the model (Qwen3.8-27B), the date of the run (1 November 2026), three runs per case, and the 4.6 s median. If a new run is published and someone forgets to edit the copy, the page says one thing and the endpoint another. The AI judges read both.

## The proposal

Add four fields, all already in `latest.json` as the runner writes them:

```
GET /api/redteam/latest → {
  attacks_blocked, attacks_total, benign_denied, benign_total, cases[],
  model,          // "Qwen/Qwen3.8-27B", the NEAR AI model id the run judged with
  started_at,     // "2026-11-01T15:11:53Z", when the run started, ISO 8601 UTC
  runs_per_case,  // 3; a case counts as right only if every run was right
  median_ms,      // 4585, median time to a verdict over runs that returned one
}
```

Fields are only added, never renamed or removed, so nothing that reads the response today breaks.

## What it costs

- In `api/`: four more fields picked out in `api/src/redteam.ts`. In `web/`: the page reads them instead of the written copy. Both in my folders.
- In the spec: one line in the endpoint table and a revision row, for example:

  | Date | Who | Change |
  | --- | --- | --- |
  | 2026-11-0X | Furqaan, William | `GET /api/redteam/latest` adds `model`, `started_at`, `runs_per_case` and `median_ms` |

- No decision record is needed, because no behaviour changes, unless you'd like one.

## What I need from you

A yes or a no, or a different set of fields. On a yes, I'll make the spec edit and the revision row for you to look over before it goes in, then build it.

## Not in this note

Two things in my lane that you should know about:
- The published run comes from the KT3 runner, which calls NEAR AI directly with the core's prompt and parser, not through `judge()`. I'll move the runner onto `judge()` and add `make redteam` before the README states these numbers.
- I'm keeping the separate `error` field on `Proposal` (pipeline errors are currently appended to `reason`) for a note of its own.
