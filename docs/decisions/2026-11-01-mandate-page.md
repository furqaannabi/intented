# The rules page: everyone sees the live mandate, the owner edits it with their own NEAR wallet

2026-11-01 · Decided by William · Status: accepted (the lookup endpoint waits on Furqaan, see below)

## Context

The build plan's web app includes a mandate editor (Day 6), and it is second on the cut list. The wallet stores only `mandate_hash`, the sha256 of the owner's text. The owner changes it with `set_mandate(text_hash)`. `POST /api/mandate` stores a text and returns its hash, but nothing reads a text back. The demo agent's text is hard-coded in `agent/src/cli.ts`, and the pipeline fails every proposal whose mandate hash isn't the wallet's. Visitors, judges included, are not the owner and can't change the demo wallet. The web app never holds a private key.

## Decision

| Question | Choice | Instead of |
| --- | --- | --- |
| Who the page is for | Everyone sees the active rules and the proof they are live; the owner can also edit them | An owner-only editor, which shows judges an empty page. Or a sandbox where visitors test their own rules, which spends NEAR AI credit on an open endpoint and is a different feature |
| Where the text comes from | The browser reads `mandate_hash` from the contract over public RPC, fetches the text from a new `GET /api/mandates/:text_hash`, and hashes it itself. It shows "live" only when the two match | An API endpoint that returns "the active mandate", which makes the check trust our API. Or storing the text on-chain, a contract change and a redeploy |
| How the owner signs | NEAR Connect (`@hot-labs/near-connect` 0.11.4), so the owner can use any NEAR wallet they already have: HOT, Meteor, MyNearWallet, Intear, Nightly, NEAR Mobile, OKX and others. It has no dependencies; each wallet's code loads from its manifest and runs in a sandboxed iframe. The owner signs `set_mandate` in their wallet | NEAR Wallet Selector 10.1.4, which bundles each wallet's SDK: the HOT module brought a native `secp256k1` build and a second, older selector core, Meteor's wanted `near-api-js` 6, and the modal hard-depends on React 18.3.1. Or a copy-paste near CLI command, which puts a terminal step in the demo |
| The agent | Before each run it reads `mandate_hash` from the contract and fetches the matching text with the same lookup, so a change takes effect on its next payment | Keeping the text hard-coded, which fails every payment after an edit |
| The contract's limits | Shown read-only next to the rules: wNEAR per payment and per day, NEAR it can attach, allowed receiver contracts, the signer (linked to its attestation), the model and whether it is frozen. All from `get_config` and `get_token` | Rules only, which hides the backstop. Or editing the limits and the freeze switch here, more owner calls than this needs before the freeze |

The editor saves the text exactly as typed (never trimmed, at most 2000 characters, as `POST /api/mandate` already enforces). It warns that the agent switches on its next payment and that the contract's limits still apply.

## Consequences

- **Waits on Furqaan:** `GET /api/mandates/:text_hash` is a new row in the interface spec. It is proposed in [this note](../note-to-furqaan-2026-11-01-mandate-lookup.md) and isn't built until both owners agree and the spec has a revision row. Until then the page can show the hash check against the contract and the limits panel, but not the text, and the agent stays hard-coded.
- **Dependencies:** one package, `@hot-labs/near-connect` 0.11.4 (about 210 kB unpacked, no dependencies), loaded only on the rules page. It replaces nothing. 0.12.0 was six days old when chosen, too new to take.
- **Trust:** wallet code is fetched at runtime from HOT Labs' manifest, not pinned in our bundle. The iframe sandbox limits what it can do, but which wallet code runs is the manifest's choice. Acceptable for one owner call (`set_mandate`); worth revisiting before anything moves money from the browser.
- **Demo risk:** an edit on the demo wallet changes what the honest and poisoned runs are judged against. Before recording, the rules must be set back to the demo text, and the page shows which text is live.
- **Owner key:** to edit from the page, the owner account's key must be in a NEAR wallet the owner uses. It comes from the shared password manager, and never touches this repo or the web app.
- **Mainnet:** the wallet id and the RPC URL are testnet values for now and change with the rest of the web app on 11 November.
