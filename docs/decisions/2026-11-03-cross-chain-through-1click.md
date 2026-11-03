# Accepted: the cross-chain payment through 1Click, with the real recipient in front of the judge

2026-11-03 · Decided by Furqaan, William · Status: accepted

## Context

The build plan's demo pays a paywall "cross-chain to Base via 1Click". The wallet pays a 1Click deposit address on NEAR, and 1Click delivers on Base. The judge saw only `args.receiver_id`, the deposit address, so it couldn't tell the vendor's Base address from an attacker's, and the poisoned-paywall attack couldn't be caught on this path. The interface spec listed this as open.

Two facts constrain the design. 1Click gives a fresh deposit address for every quote. And it runs on mainnet only: its token list, checked on 3 November, has 210 tokens on 38 chains and nothing on any testnet.

William proposed the design in [this note](../note-to-furqaan-2026-11-03-cross-chain.md). Furqaan's agreement came through William on 3 November, as a go-ahead on everything in it.

## Decision

- **The API quotes, not the agent.** The agent proposes the intent through `POST /api/propose`'s second body, `{ mandate_id, cross_chain: { token, amount, dest_chain, dest_asset, recipient }, context }`. The API gets the 1Click quote and builds the `ft_transfer` to the deposit address. The agent never picks a deposit address.
- **The vendor receives exactly its price.** Quotes are exact-output. The wallet sends the quoted input, fees and a 1% slippage buffer included, and 1Click refunds what the swap doesn't use to the wallet. The caps apply to what leaves the wallet. A dry quote on 3 November: exactly 0.40 USDC delivered on Base for 0.406549 sent, of which at least 0.402483 is used.
- **The judge sees the real recipient.** The firewall puts an optional `cross_chain` field in the judge request, filled from the quote: `{ deposit_address, dest_chain, dest_asset, recipient, amount_out, deadline_ms }`. When it is present, the prompt treats `cross_chain.recipient` on `dest_chain` as the payee. Like `amount`, the field is the firewall's own data, not context. `judge()` takes it as an optional fifth argument.
- **`execute` checks the field.** The method is `ft_transfer`, `deposit_address` equals `args.receiver_id`, `recipient` is lowercase `0x` plus 40 hex characters, and `expiry_ms` is earlier than `deadline_ms`.
- **The owner keeps a hard limit.**
  - A cross-chain switch, off by default. While it is off, `execute` refuses any request with the field.
  - An optional list of allowed recipients. While it is empty, the switch alone decides. Once it isn't empty, `execute` refuses any other recipient, even with an `ALLOW`.
  - Both show in `get_config`.
- **The paywall checks Base itself.** It reads the Base transaction receipt from a public RPC with plain `fetch` and looks for a USDC transfer to the vendor of at least the price. No new dependency.
- **On testnet, a local stand-in replaces 1Click alone.** Everything else runs for real: the judge, the field, the `execute` checks, the transfer. Every delivery the stand-in reports is marked `simulated` on the proposal (`oneclick.simulated`), shown as simulated in the web app, and never presented as a real Base payment. The real cross-chain payment runs only on mainnet.
- **`Proposal.oneclick` widens** to `{ deposit_address, dest_chain, recipient, amount_out, status, dest_tx_hash?, simulated }`, so the web app names the Base recipient as the payee.
- **Red team:** about 8 attack and 8 honest cross-chain cases are added. Once the prompt change lands, one `make redteam` run covering every case is published.
- **Who builds what:**
  - Furqaan, in `contract/` and `firewall-core/`: the field, the prompt, the `execute` checks, the switch and the list.
  - William, in `api/`, `agent/`, `web/` and `redteam/`: the rest.

## Consequences

- The contract can't prove that 1Click delivers to `recipient`. That link is the API's word about the quote, checkable afterwards through 1Click's status for the deposit address. The README must say this plainly when the feature ships, next to the line about attestation.
- A wNEAR transfer to a deposit address without the field is, to the contract, an ordinary NEAR payment to an unknown account. Only the judge stops it, as it stops any payee the mandate doesn't name.
- The first real cross-chain payment can't happen before the 11 November mainnet deploy. It and KT4's $2 payment still need a yes from both owners.
- The published red-team numbers change once the new cases run.
- If time runs short, drop the recipient list first and keep the switch. After that, the whole leg goes, as CLAUDE.md's cut list says. The NEAR payment and the attack demo stay either way.
