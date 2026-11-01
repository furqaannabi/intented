# Note to Furqaan: look up a mandate by its hash

From William, 1 November. A proposed spec change, not built yet. Nothing in your folders changes; it needs your yes.

## Why

I'm building the rules page (the build plan's mandate editor). Design: [record](./decisions/2026-11-01-mandate-page.md). The wallet stores only `mandate_hash`, and the API can store a mandate's text but can't give it back. So neither the page nor the agent can find out what the active rules say.

- **The page** reads `mandate_hash` from the contract itself, then needs the text to show it. It hashes that text in the browser and shows "live" only on a match, so the check doesn't rely on the API being honest.
- **The agent** has its mandate text hard-coded in `agent/src/cli.ts`. When the owner sets new rules, the pipeline fails every payment ("this mandate is not active on the wallet") until the code changes. With the lookup, the agent reads the hash from the contract before each run and fetches the text, so it follows the owner's change.

## The proposal

One new row in the HTTP API table:

| Endpoint | In | Out |
| --- | --- | --- |
| `GET /api/mandates/:text_hash` | | `{ mandate_id, text, text_hash }` |

- `text_hash` is 64 lowercase hex characters, as in `set_mandate`. Anything else is a 400.
- 404 when no stored mandate has that hash.
- The text is returned byte for byte as it was posted. Several stored mandates can share a hash (the agent posts its text on every run), and any of them will do; the API returns the newest.
- Public and read-only, like `GET /api/proposals`: the text is what the owner chose to publish by setting its hash on a public contract.

Nothing changes in the contract, the firewall core, `POST /api/mandate` or `POST /api/propose`.

## What it costs

- In `api/`: one route over the existing `mandates` table. In `agent/`: read `get_config` before each run and use the looked-up `mandate_id`. In `web/`: the rules page. All in my folders.
- In the spec: the row above and a revision row, for example:

  | Date | Who | Change |
  | --- | --- | --- |
  | 2026-11-0X | Furqaan, William | `GET /api/mandates/:text_hash` returns a stored mandate's text by its hash |

## What I need from you

A yes, a no, or a different shape. Until then I'll build only the parts of the page that don't need it: the wallet sign-in, `set_mandate`, the hash read from the contract, and the limits panel.

## Also open

The earlier [red-team fields note](./note-to-furqaan-2026-11-01-redteam-fields.md) has mostly lost its reason, since the page no longer shows those figures ([record](./decisions/2026-11-01-no-redteam-figures-on-the-page.md)). Treat it as withdrawn unless you want the fields for the README.
