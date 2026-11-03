# Note to Furqaan: the cross-chain payment through 1Click

From William, 3 November. A proposed spec change, not built yet. Most of it is in your folders, so it needs your yes, or a different shape.

## Why

The build plan's demo pays the paywall "cross-chain to Base via 1Click". The wallet pays a 1Click **deposit address** on NEAR, and 1Click delivers on Base. Today the judge would see only that deposit address: the prompt's rule 5 says the payee is `args.receiver_id`. So it can't tell the vendor's Base address from `0xATTACKER`, and the demo's attack can't be caught on this path.

Two facts shape the rest:

- 1Click gives a fresh deposit address for every quote, so an on-chain list of deposit addresses can't work.
- 1Click is mainnet only. Its token list (210 tokens, 38 chains, checked today) has nothing on any testnet.

## What I've decided on my side

All in `api/`, `agent/`, `web/` and `redteam/`:

- **The API quotes, not the agent.** The agent proposes the intent, "pay 0.40 USDC to 0x… on Base". The API gets the 1Click quote and builds the `ft_transfer` to the deposit address itself, so the agent never picks a deposit address.
- **The vendor receives the exact price.** The quote becomes exact-output: the wallet pays the quoted input, fees included, and 1Click refunds any surplus to the wallet. Caps apply to what leaves the wallet. The refund account is always the wallet itself.
- **The paywall checks Base itself.** It reads the Base transaction receipt from a public RPC for a USDC transfer to the vendor. There's no new dependency.
- **On testnet, a mock stands in for 1Click alone.** It hands out a testnet deposit account and reports delivery. Everything else is real: the judge, your new checks, the transfer. Every mock delivery is labelled "simulated" and is never shown as a real Base payment. Real 1Click runs only on mainnet.
- **Red team:** about 8 attack and 8 honest cross-chain cases, run through `make redteam` once your prompt lands, then one published run covering all 69 cases.

## The proposal for your side

### 1. A new field in the judge request

It works like `amount`. The firewall fills it from the quote, and the agent never writes it:

```
cross_chain?: {
  deposit_address,  // the 1Click deposit address; must equal args.receiver_id
  dest_chain,       // "base"
  dest_asset,       // the 1Click asset id, e.g. nep141:base-0x8335…omft.near
  recipient,        // the address on dest_chain, lowercase 0x + 40 hex
  amount_out,       // what the recipient gets, exact, in whole tokens with the symbol: "0.40 USDC"
  deadline_ms,      // the quote's deadline; the action's expiry_ms must be earlier
}
```

- `judge()` would take it as an optional fifth argument.
- `POST /api/propose` gets a second body form, `{ mandate_id, cross_chain: { token, amount, dest_chain, dest_asset, recipient }, context }`, which the API turns into the action and the field.

### 2. The prompt

- When `cross_chain` is present, the payee is `cross_chain.recipient` on `cross_chain.dest_chain`, not `args.receiver_id`. The amount the recipient gets is `amount_out`; what the wallet pays is still `amount`.
- Like `amount`, the field is trusted firewall data, not context.

### 3. `execute`

Check 6 accepts the field only when all of these hold:

- the method is `ft_transfer`;
- `deposit_address` equals `args.receiver_id`;
- `recipient` is lowercase `0x` plus 40 hex characters;
- `expiry_ms` is before `deadline_ms`;
- the owner's switch is on;
- if the owner's recipient list isn't empty, `recipient` is on it.

### 4. Owner controls

- **A cross-chain switch**, off by default. While it's off, `execute` refuses any request with the field.
- **An optional list of allowed recipients.** While it's empty, the switch alone decides and the judge checks the recipient against the rules. Once the owner adds an address, the contract refuses any other recipient, even on an `ALLOW`.
- Method names are yours, for example `set_cross_chain(enabled)`, `allow_cross_chain_recipient(address)` and `disallow_cross_chain_recipient(address)`. Both settings show in `get_config`.

## What the contract still can't prove

That 1Click will deliver to `recipient`. That link is the API's word about the quote, checkable afterwards through 1Click's status for the deposit address. The README has to say this plainly, next to the existing line about attestation.

## Cut order, if time is short

1. Drop the recipient list. Keep the switch.
2. Then the whole leg, as the cut list already says. The NEAR payment and the attack demo stay.

## Mainnet

The real cross-chain payment, the 11 November deploy and KT4's $2 payment all still need a yes from both of us. Nothing here moves money.

## In the spec

A judge request field, a second `POST /api/propose` body, the `execute` check, two owner methods, and the `get_config` fields. The revision row and the record follow once you've agreed.

## What I need from you

A yes, a no, or a different shape, for the field above all. Until then I'll build only what doesn't depend on it:

- the exact-output quote;
- the mock 1Click;
- the paywall's Base check;
- the deposit status in the web app.
