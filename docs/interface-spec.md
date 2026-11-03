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
}
```

## Verdict

What the model must return, as structured JSON output, in this order:

```
{ "reason": "<at most 280 characters>", "verdict": "ALLOW" | "DENY", "action": "<canonical_bytes>" }
```

## Contract methods (Furqaan)

| Method | Who may call |
| --- | --- |
| `new(owner_id, agent_id, model_id)` | init, once |
| `set_mandate(text_hash)` · `set_prompt_hash(text_hash)` · `set_model_id(model_id)` | owner |
| `register_signer(eth_address)` · `revoke_signer(eth_address)` | owner |
| `allow_receiver(receiver_id)` · `disallow_receiver(receiver_id)` | owner |
| `set_token(token_id, { symbol, decimals, caps: { per_tx, daily } })` · `set_near_caps({ per_tx, daily })` | owner |
| `freeze()` · `unfreeze()` | owner |
| `propose(action, args_json) -> proposal_id` | the agent's function-call key |
| `execute(proposal_id, req_bytes, resp_bytes, sig_65) -> Promise` | the agent's function-call key |
| `get_config()` · `get_token(token_id)` · `get_proposal(proposal_id)` | anyone (views) |

`propose` requires `sha256(args_json) == args_sha256`. `execute` succeeds only when every check passes:

1. The caller is the agent and the proposal is pending.
2. The wallet is not frozen.
3. The receiver is on the allowlist.
4. The nonce is unused.
5. The action has not expired.
6. The request is exactly the judge request above: no other fields, no duplicate keys, the wallet's `model_id`, the registered prompt hash, the owner's mandate hash, this proposal's canonical bytes and args, and for a token transfer the wallet's formatting of the amount.
7. The verdict is exact JSON for this action, and it is `ALLOW`.
8. `model_id + ":" + sha256(req) + ":" + sha256(resp)`, the text NEAR AI signs (EIP-191, recovered with `env::ecrecover`), recovers an allowlisted signer.
9. The NEAR deposit is within its per-transaction and daily caps; for `ft_transfer` and `ft_transfer_call`, the token has caps set and `args.amount` is within them. The daily window is the UTC day.

A callback then marks the proposal `executed` or `failed`.

## Firewall core (Furqaan)

The seam. William's API imports it, configured once through two factories:

```
createJudge({ apiKey, model, network }) -> judge
judge(mandate_text, action, args_json, context) ->
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

## HTTP API (William builds; the UI and the agent use it)

| Method and path | Body or query | Returns |
| --- | --- | --- |
| `POST /api/mandate` | `{ text }` | `{ mandate_id, text_hash }` |
| `GET /api/mandates/:text_hash` | | `{ mandate_id, text, text_hash }`: the stored text whose sha256 is `text_hash`, byte for byte. 400 unless `text_hash` is 64 lowercase hex characters, 404 if none; when several share it, the newest. Public |
| `POST /api/propose` | `{ mandate_id, action, args, context }` | `{ proposal_id }` |
| `GET /api/proposals` | `?since=ts` (changed after `ts`) | `[ Proposal ]` |
| `GET /api/proposals/:id` | | `Proposal` |
| `GET /api/redteam/latest` | | `{ attacks_blocked, attacks_total, benign_denied, benign_total, cases[] }` |

```
Proposal = {
  id, created_at, updated_at, action, args, context_excerpt,
  status: "pending" | "allowed" | "denied" | "executed" | "failed",
  verdict, reason, model, chat_id, signature, signer, attestation_url,
  near_tx_hash?,
  oneclick?: { deposit_address, status, dest_tx_hash? },
}
```

`attestation_url` links the signer's published report in `docs/attestations/<signer>.json`, or is `null`.

## Open

- How the judge sees the real recipient of a cross-chain payment, whose payee on NEAR is a 1Click deposit address. Only needed if the real cross-chain payment stays in.

## Revision

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-01 | Furqaan | Copied from §5 of the build plan, unchanged |
| 2026-11-01 | Furqaan, William | Check 2 uses NEAR AI's signed text with the model id; signature scheme ECDSA through `env::ecrecover`; model Qwen3.8-27B. Records: [signed text](./decisions/2026-11-01-accept-model-id-signed-text.md), [go on Qwen](./decisions/2026-11-01-go-intented-on-qwen.md) |
| 2026-11-01 | Furqaan, William | Judge request section; verdict field order; owner methods, views and init; the full `execute` checks including the request and amount; the core's factories; `updated_at` on `Proposal`; `attestation_url` source. Record: [accepted](./decisions/2026-11-01-accept-wallet-seam-amount-and-updated-at.md) |
| 2026-11-03 | Furqaan, William | `GET /api/mandates/:text_hash` returns a stored mandate's text by its hash, so the rules page and the agent can read the active mandate; its text is public. Record: [accepted](./decisions/2026-11-03-accept-mandate-lookup.md) |
