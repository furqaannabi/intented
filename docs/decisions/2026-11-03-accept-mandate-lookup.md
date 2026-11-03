# Accepted: look up a mandate's text by its hash, and say the active mandate is public

2026-11-03 · Decided by Furqaan, William · Status: accepted

## Context

The wallet stores only `mandate_hash`. `POST /api/mandate` stores a text but nothing could read it back, so the rules page couldn't show the active rules, and the demo agent, whose text was hard-coded, failed every payment after the owner set a new mandate. William proposed one read-only endpoint in [this note](../note-to-furqaan-2026-11-01-mandate-lookup.md), for the [rules page](./2026-11-01-mandate-page.md). Furqaan reviewed it.

## Decision

- **Add `GET /api/mandates/:text_hash`** → `{ mandate_id, text, text_hash }`. It returns the stored text whose sha256 is `text_hash`, byte for byte. It's a 400 unless `text_hash` is 64 lowercase hex characters, and a 404 if none matches; when several share the hash, it returns the newest. It's public and read-only.
- **A lying API can't change what's enforced**, because the hash is checked at two points that don't trust it. The rules page shows a text as live only if it hashes, in the browser, to the wallet's on-chain `mandate_hash`. And `execute` refuses any verdict whose request carries a mandate that doesn't hash to `mandate_hash`. Spamming `POST /api/mandate` can't spoof a lookup either: a lookup by hash returns only text with that exact hash.
- **The condition:** the endpoint makes the active mandate's text public; before, only its hash was. Because we're entered in the Privacy & Private AI track, the README says so plainly. Putting the endpoint behind the agent's token would keep the text private, but leave the public rules page empty, so not for the hackathon.
- **Nothing else changes:** not the contract, the firewall core, `POST /api/mandate` or `POST /api/propose`.
- **The [red-team fields note](../note-to-furqaan-2026-11-01-redteam-fields.md) is withdrawn.** The README's numbers come from `make redteam` output, not from extra endpoint fields.

## Consequences

- The agent reads `mandate_hash` from the contract before each run and fetches the text with this lookup, so an owner's change takes effect on its next payment.
- Mandates are public by design in this version. A private mandate, such as one stored only inside the TEE and readable by the owner, would be a later change and would need its own record.
