# The firewall core's interface is the seam: a stub until Day 6, the real core after

2026-11-01 · Decided by Furqaan and William (build plan §5) · Status: accepted

## Context

Furqaan's contract and firewall core and William's API, UI and demo agent are built at the same time. If William's half waited for a working core, it would start on Day 6.

## Decision

The firewall core exposes three functions, fixed in [`interface-spec.md`](../interface-spec.md): `judge`, `proposeOnChain` and `executeOnChain`. William's API imports them. Until 6 November it uses a stub with the same signatures that returns fake signed verdicts; on 6 November Furqaan replaces the stub with the real core, and 7 November is integration day.

The interface is locked on the morning of 1 November and changes only when both agree, with a revision row in the spec and a record here when behaviour changes.

## Consequences

- Neither person waits on the other before Day 6.
- To watch: the stub's verdicts are fake. Nothing signed by the stub should be shown in the UI or a recording as a verified verdict.
- If the core is not ready by Day 6, the demo is recorded from scripts against real testnet transactions, with the UI as the viewer (plan §9).
