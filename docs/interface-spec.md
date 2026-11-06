# Interface spec

The one shared shape. The contract, the firewall core, the API and the UI all use the same encoding, and the firewall core's three functions are the seam between Furqaan's code and William's. The real core has been available since 1 November; a stub is only for UI work without NEAR AI calls, and its verdicts are never shown as verified.

**Change it only when both of you agree.** Every change gets a row in the revision table below and, if it changes behaviour, a dated record in [`decisions/`](./decisions/README.md).

Source: §5 of [`Intented hackathon plan.pdf`](./Intented%20hackathon%20plan.pdf), revised as below.

## Canonical action

The service and the contract encode it byte for byte the same way.

```
action = {
  receiver_id,  // a valid NEAR account id
  method,       // [A-Za-z_][A-Za-z0-9_]*
  args_sha256,  // lowercase hex sha256 of the exact args_json
  deposit,      // yoctoNEAR, as a canonical decimal string
  nonce,        // u64, as a decimal string in JSON
  expiry_ms,    // u64, as a decimal string in JSON
}

canonical_bytes = "INTENTED_V1|" + receiver_id + "|" + method + "|" + args_sha256
                + "|" + deposit + "|" + nonce + "|" + expiry_ms
```

## Judge request

What the firewall core sends NEAR AI, and what `execute` checks it was: exactly `model`, `stream: false`, `temperature: 0`, `chat_template_kwargs: { enable_thinking: false }`, `response_format` (the verdict schema, `action` pinned to the canonical bytes) and two messages.

- **System:** the firewall core's rules plus the network's trusted token table. The wallet stores its sha256 (`set_prompt_hash`).
- **User:** one JSON object:

```
{
  mandate,   // the owner's text; sha256 must equal the wallet's mandate_hash
  action,    // the canonical bytes
  args,      // the exact args_json
  context,   // what the agent read; untrusted, not checked
  amount?,   // only for ft_transfer / ft_transfer_call on a known token: args.amount in whole
             // tokens with the symbol, e.g. "0.001 wNEAR"; the wallet requires exactly its own formatting
  cross_chain?,  // only for a payment through 1Click, filled by the firewall from the quote, never by the agent
}

cross_chain = {
  deposit_address,  // the 1Click deposit address; equals args.receiver_id
  dest_chain,       // e.g. "base"
  dest_asset,       // the 1Click asset id, e.g. nep141:base-0x8335…omft.near
  recipient,        // the address on dest_chain, lowercase 0x + 40 hex
  amount_out,       // what the recipient receives, exactly, in whole tokens with the symbol: "0.40 USDC"
  deadline_ms,      // the quote's deadline, u64 as a decimal string; the action's expiry_ms is earlier
  signed_quote: {
    payload,        // the exact json-stable-stringify string 1Click signs, built from its signed fields only
    signature,      // 1Click's "ed25519:…" signature over the UTF-8 bytes of base58(sha256(payload))
  },
}
```

When `cross_chain` is present, the payee the judge checks is `cross_chain.recipient` on `cross_chain.dest_chain`, not `args.receiver_id`. Like `amount`, it is the firewall's own data, not context. The signed fields are listed in [this record](./decisions/2026-11-03-accept-signed-1click-quote.md); `payload` is never the whole quote response.

## Verdict

What the model must return, as structured JSON output, in this order:

```
{ "reason": "<at most 280 characters>", "verdict": "ALLOW" | "DENY", "action": "<canonical_bytes>" }
```

## Contract methods (Furqaan)

| Method | Who may call |
| --- | --- |
| `new(owner_id, agent_id, model_id)` | init, once |
| `new_with(owner_id, agent_id, model_id, setup)` | init, once (the factory's one-call setup) |
| `set_mandate(text_hash)` · `set_prompt_hash(text_hash)` · `set_model_id(model_id)` | owner |
| `register_signer(eth_address)` · `revoke_signer(eth_address)` | owner |
| `allow_receiver(receiver_id)` · `disallow_receiver(receiver_id)` | owner |
| `set_token(token_id, { symbol, decimals, caps: { per_tx, daily } })` · `set_near_caps({ per_tx, daily })` | owner |
| `set_cross_chain(enabled)` · `allow_cross_chain_recipient(address)` · `disallow_cross_chain_recipient(address)` · `set_one_click_key(public_key)` | owner |
| `freeze()` · `unfreeze()` | owner |
| `withdraw(token_id?, amount)` | owner |
| `add_agent_key(public_key, allowance)` · `remove_agent_key(public_key)` | owner |
| `prune(proposal_ids)` | anyone for executed, failed or expired-pending proposals; the owner also for any pending one; at most 64 ids |
| `propose(action, args_json) -> proposal_id` | the agent's function-call key |
| `execute(proposal_id, req_bytes, resp_bytes, sig_65) -> Promise` | the agent's function-call key |
| `get_config()` · `get_token(token_id)` · `get_proposal(proposal_id)` | anyone (views) |

```
setup = { signer, prompt_hash, mandate_hash?, token_id, token: { symbol, decimals, caps }, near_caps }
```

- `new_with` applies the same checks as the owner's setters, and allowlists `token_id` as a receiver.
- `withdraw` sends a token (`ft_transfer`) or, with no `token_id`, NEAR above what the wallet's storage needs, to the owner. Unjudged; works while frozen.
- `add_agent_key` adds a function-call key on the wallet's own account, scoped to `propose` and `execute` on it, with a positive allowance. Never a full-access key.

`propose` requires `sha256(args_json) == args_sha256`. It also refuses `args_json` over 2048 bytes, a `method` over 64 characters, an action whose `receiver_id` is the wallet itself, an `expiry_ms` more than an hour ahead, and a proposal while 32 are pending. A successful `execute` frees its slot. `execute` succeeds only when every check passes:

1. The caller is the agent and the proposal is pending.
2. The wallet is not frozen.
3. The receiver is on the allowlist.
4. The nonce is unused.
5. The action has not expired.
6. The request is exactly the judge request above: no other fields, no duplicate keys, the wallet's `model_id`, the registered prompt hash, the owner's mandate hash, this proposal's canonical bytes and args, and for a token transfer the wallet's formatting of the amount. A request with `cross_chain` also needs all of these:
   - the method is `ft_transfer`, and `cross_chain.deposit_address` equals `args.receiver_id`;
   - `cross_chain.recipient` is lowercase `0x` plus 40 hex characters;
   - `expiry_ms` is earlier than `cross_chain.deadline_ms`;
   - the owner's cross-chain switch is on (it is off by default);
   - if the owner's cross-chain recipient list is not empty, `cross_chain.recipient` is on it;
   - the owner has set a 1Click key, and `signed_quote.signature` verifies over `base58(sha256(signed_quote.payload))` with it;
   - `payload` parses with no duplicate keys; `dry` is false, `swapType` is `EXACT_OUTPUT`, `recipientType` is `DESTINATION_CHAIN`, and there is no `depositMemo`;
   - `depositAddress` equals `cross_chain.deposit_address` and `args.receiver_id`;
   - `recipient`, lowercased, equals `cross_chain.recipient`, and `destinationAsset` equals `cross_chain.dest_asset`;
   - `originAsset` is `nep141:` plus the token being sent, and `amountIn` equals `args.amount`;
   - `refundTo` is the wallet itself;
   - `cross_chain.amount_out` starts with `amountOutFormatted` and a space.
7. The verdict is exact JSON for this action, and it is `ALLOW`.
8. `model_id + ":" + sha256(req) + ":" + sha256(resp)`, the text NEAR AI signs (EIP-191, recovered with `env::ecrecover`), recovers an allowlisted signer.
9. The NEAR deposit is within its per-transaction and daily caps; for `ft_transfer` and `ft_transfer_call`, the token has caps set and `args.amount` is within them. The daily window is the UTC day.

A callback then marks the proposal `executed` or `failed`.

`get_config` also returns the cross-chain switch, the recipient list and the 1Click key. The signed quote ties the deposit address to the recipient, so the deposit address is not the API's word. The contract still can't prove that 1Click delivers, or that the quote is fresh: delivery is checkable afterwards through 1Click's status for the deposit address, and a deposit to an expired quote is refunded to the wallet.

## Wallet factory (Furqaan, testnet only)

| Method | Who may call |
| --- | --- |
| `new(code)` | init, once; the code for new wallets changes only by `set_code` |
| `create(name, model_id, setup, agent_key?, agent_allowance?) -> Promise` | anyone, with a deposit of at least `get_min_deposit()` |
| `set_code(code)` | the factory account itself; wallets already made keep their code |
| `get_code_hash()` · `get_min_deposit()` · `get_wallets(owner_id, from_index?, limit?)` | anyone (views); `get_wallets` lists the wallets an owner created, oldest first, at most 100 per page |

`create` makes `<name>.<factory>` in one batch: create the account, transfer the deposit, deploy the stored code, call `new_with` with the caller as owner and the wallet as its own agent, and, if `agent_key` is given, add it scoped to `propose` and `execute`. It adds no full-access key. If the batch fails, the deposit is refunded to the caller. `get_code_hash()` is base58(sha256(code)), the form NEAR shows as an account's `code_hash`.

## Firewall core (Furqaan)

The seam. William's API imports it, configured once through two factories:

```
createJudge({ apiKey, model, network }) -> judge
judge(mandate_text, action, args_json, context, cross_chain?) ->
    { verdict, reason, model, chat_id, req_bytes, resp_bytes, signature, signer }

createChainClient({ rpcUrl, walletId, agentId, agentPrivateKey }) -> { proposeOnChain, executeOnChain }
proposeOnChain(action, args_json) -> { proposal_id, near_tx_hash }
executeOnChain(proposal_id, req_bytes, resp_bytes, signature) -> { near_tx_hash, ok, error? }
```

`ok` means every receipt succeeded, including the proposed call. A refused `execute` still returns its hash.

## 1Click module (William)

```
payCrossChain({ amount, origin_asset, dest_asset, recipient, refund_to })
    -> { deposit_address, quote }    // the contract executes ft_transfer to deposit_address

trackDeposit(deposit_address) -> { status, dest_tx_hash? }
```

The quote is exact-output: `amount` is what `recipient` receives, and the wallet sends `quote.amountIn`, fees and a 1% slippage buffer included. 1Click refunds what the swap doesn't use to `refund_to`, which is always the wallet. 1Click runs on mainnet only; on testnet a local stand-in replaces it, and every delivery it reports is marked `simulated`.

## HTTP API (William builds; the UI and the agent use it)

| Method and path | Body or query | Returns |
| --- | --- | --- |
| `POST /api/mandate` | `{ text }` | `{ mandate_id, text_hash }`. A text already stored gets its stored `mandate_id`. Over the rate limit, `429` with `Retry-After` |
| `GET /api/mandates/:text_hash` | | `{ mandate_id, text, text_hash }`: the stored text whose sha256 is `text_hash`, byte for byte. 400 unless `text_hash` is 64 lowercase hex characters, 404 if none; when several share it, the newest. Public |
| `POST /api/quote` | `{ wallet_id, intent: { token, amount, dest_chain, dest_asset, recipient } }`, for a payment through 1Click before the agent proposes it; `amount` is what the recipient receives | `{ quote_id, deposit_address, token, amount_in, deadline_ms, amount_out }`: the agent proposes an `ft_transfer` of `amount_in` of `token` to `deposit_address`, expiring before `deadline_ms`, then asks `POST /api/verdict` with `quote_id`. `400` for a malformed body; `409` if the wallet has cross-chain payments off (a recipient off the wallet's list is quoted: the model judges it and the wallet refuses it at `execute`); `429` with `Retry-After` past 30 quotes per wallet or 120 in all per hour; `501` without a 1Click client |
| `POST /api/verdict` | `{ wallet_id, proposal_id, context, quote_id? }`. For a proposal the wallet's own agent made with `propose`; the API reads its action and args from the chain. `wallet_id` is `intented-wallet.testnet` or `<label>.intented.testnet`. With `quote_id`, a payment through 1Click: the proposal must be an `ft_transfer` of the quote's token and `amount_in` to its deposit address, expiring before its deadline, and the API judges it with `cross_chain` built from its stored quote. A quote serves one proposal | `{ id, verdict, reason, model, chat_id, signer, signature, req_bytes, resp_bytes }`, `req_bytes` and `resp_bytes` base64, ready for `execute(proposal_id, req_bytes, resp_bytes, signature)`. Judged once per proposal: a repeat gets the stored answer. `400` for another `wallet_id` or a malformed body; `409` if the wallet is frozen, its model or prompt hash isn't this API's, its mandate text isn't stored, or the proposal isn't pending with at least 60 seconds left; `429` with `Retry-After` past 30 verdicts per wallet per hour. With `quote_id`, also `409` if the quote is unknown, used, past its deadline, for another wallet, or doesn't match the proposal |
| `POST /api/executed` | `{ wallet_id, proposal_id, near_tx_hash }`, sent by the agent after `execute` | `{ id }`. The API looks the transaction up: a call to that wallet's `execute` with that `proposal_id`, signed by the wallet's agent, that succeeded, or for a `DENY` that the wallet refused. It stores the hash as the proposal's `near_tx_hash`, and for a payment through 1Click tells 1Click about the deposit and follows it. `400` for a malformed body; `404` if the proposal wasn't judged here; `409` if the transaction isn't that call, or didn't succeed on an `ALLOW`. Optional: the status is settled from the wallet's record either way |
| `GET /api/proposals` | `?since=ts` (changed after `ts`), `?wallet=` (one wallet's) | `[ Proposal ]` |
| `GET /api/proposals/:id` | | `Proposal` |
| `GET /api/redteam/latest` | | `{ attacks_blocked, attacks_total, benign_denied, benign_total, cases[] }` |

```
Proposal = {
  id, wallet_id, created_at, updated_at, action, args, context_excerpt,
  status: "pending" | "allowed" | "denied" | "executed" | "failed",
  verdict, reason, model, chat_id, signature, signer, attestation_url,
  near_tx_hash?,
  oneclick?: { deposit_address, dest_chain, recipient, amount_out, status, dest_tx_hash?, simulated },
}
```

`wallet_id` is the wallet the proposal is on. The wallet's agent sends the transactions, never the API: the status is read from the wallet's `get_proposal`, and `near_tx_hash` is empty until the agent reports its `execute` through `POST /api/executed`.

`attestation_url` links the signer's published report in `docs/attestations/<signer>.json`, or is `null`.

## Revision

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-01 | Furqaan | Copied from §5 of the build plan, unchanged |
| 2026-11-01 | Furqaan, William | Check 2 uses NEAR AI's signed text with the model id; signature scheme ECDSA through `env::ecrecover`; model Qwen3.8-27B. Records: [signed text](./decisions/2026-11-01-accept-model-id-signed-text.md), [go on Qwen](./decisions/2026-11-01-go-intented-on-qwen.md) |
| 2026-11-01 | Furqaan, William | Judge request section; verdict field order; owner methods, views and init; the full `execute` checks including the request and amount; the core's factories; `updated_at` on `Proposal`; `attestation_url` source. Record: [accepted](./decisions/2026-11-01-accept-wallet-seam-amount-and-updated-at.md) |
| 2026-11-03 | Furqaan, William | `GET /api/mandates/:text_hash` returns a stored mandate's text by its hash, so the rules page and the agent can read the active mandate; its text is public. Record: [accepted](./decisions/2026-11-03-accept-mandate-lookup.md) |
| 2026-11-03 | Furqaan, William | The cross-chain payment through 1Click: the `cross_chain` judge request field and its `execute` checks, the owner's cross-chain switch and recipient list, `judge()`'s fifth argument, the second `POST /api/propose` body, exact-output quotes, and the wider `oneclick` on `Proposal`. Settles the open question on the cross-chain recipient. Record: [accepted](./decisions/2026-11-03-cross-chain-through-1click.md) |
| 2026-11-03 | Furqaan, William | `cross_chain.signed_quote` and `set_one_click_key`: `execute` verifies 1Click's signed quote, so the deposit address is tied to the recipient. The payload is built from 1Click's signed fields, checked against a live mainnet quote. Records: [proposed](./decisions/2026-11-03-execute-verifies-the-1click-quote.md), [accepted](./decisions/2026-11-03-accept-signed-1click-quote.md) |
| 2026-11-04 | Furqaan, William | `POST /api/propose` takes an optional `Idempotency-Key`, so a retried cross-chain payment is sent once; the spec lists the `409` for a reused key or nonce, and `POST /api/mandate`'s stored-text answer and `429`. Records: [proposed](./decisions/2026-11-04-idempotency-key-on-propose.md), [accepted](./decisions/2026-11-04-accept-idempotency-key.md) |
| 2026-11-04 | Furqaan, William | `POST /api/verdict` judges a proposal any factory wallet's own agent made, and the agent sends its own `execute`; `wallet_id` on `Proposal`; `?wallet=` on `GET /api/proposals`. Records: [proposed](./decisions/2026-11-04-verdict-for-any-wallet.md), [accepted](./decisions/2026-11-04-accept-verdict-for-any-wallet.md) |
| 2026-11-05 | Furqaan, William | `POST /api/quote` for payments through 1Click before the agent proposes; `quote_id` on `POST /api/verdict`; `POST /api/executed` reports the agent's `execute`; `POST /api/propose` is removed once the demos have moved. Records: [proposed](./decisions/2026-11-05-demo-agent-holds-its-own-key.md), [accepted](./decisions/2026-11-05-accept-demo-agent-own-key.md) |
| 2026-11-05 | Furqaan, William | `POST /api/quote` no longer refuses a recipient off the wallet's cross-chain list. Record: [here](./decisions/2026-11-05-quote-skips-recipient-list.md) |
| 2026-11-05 | Furqaan, William | `POST /api/propose` removed, with its `Idempotency-Key`: all four demos run on `POST /api/verdict`, and the API holds no NEAR key. Record: [accepted](./decisions/2026-11-05-accept-demo-agent-own-key.md) |
| 2026-11-05 | William | `POST /api/executed` also takes the wallet's refused `execute` of a `DENY`, so a refusal's receipt links its transaction. Record: [here](./decisions/2026-11-05-receipts-link-refused-execute.md) |
| 2026-11-06 | Furqaan, William | `propose`'s size limits, self-call refusal and bound of 32 pending proposals expiring within the hour; `new_with`, `withdraw`, `add_agent_key`, `remove_agent_key`, `prune`; the testnet wallet factory with `get_wallets`. Records: [factory](./decisions/2026-11-04-wallet-factory-on-testnet.md), [as built](./decisions/2026-11-04-factory-as-built.md), [bounded proposals](./decisions/2026-11-04-bounded-proposals-and-mainnet-key.md), [accepted](./decisions/2026-11-06-accept-wallet-factory-and-bounded-proposals.md) |
