# Interface spec

The one shared shape. The contract, the firewall core, the API and the UI all use the same encoding, and the firewall core's three functions are the seam between Furqaan's code and William's. William's API calls a stub of the core that returns fake signed verdicts until Day 6 (6 November), when Furqaan swaps in the real one.

**Change it only when both of you agree.** Every change gets a row in the revision table below and, if it changes behaviour, a dated record in [`decisions/`](./decisions/README.md).

Source: §5 of [`Intented hackathon plan.pdf`](./Intented%20hackathon%20plan.pdf).

## Canonical action

The service and the contract encode it byte for byte the same way.

```
action = {
  receiver_id,
  method,
  args_sha256,
  deposit,      // yoctoNEAR, as a string
  nonce,        // u64
  expiry_ms,    // u64
}

canonical_bytes = "INTENTED_V1|" + receiver_id + "|" + method + "|" + args_sha256
                + "|" + deposit + "|" + nonce + "|" + expiry_ms
```

## Verdict

What the model must return, as structured JSON output:

```
{ "verdict": "ALLOW" | "DENY", "reason": "<at most 280 characters>", "action": "<canonical_bytes>" }
```

## Contract methods (Furqaan)

| Method | Who may call |
| --- | --- |
| `set_mandate(text_hash)` | owner |
| `register_signer(eth_address)` | owner |
| `revoke_signer` | owner |
| `freeze()` · `unfreeze()` | owner |
| `propose(action, args_json) -> proposal_id` | the agent's function-call key |
| `execute(proposal_id, req_bytes, resp_bytes, sig_65) -> Promise` | the agent's function-call key |

`execute` succeeds only when every check passes:

1. The signer is on the allowlist.
2. `model_id + ":" + sha256(req) + ":" + sha256(resp)`, the text NEAR AI signs (EIP-191, recovered with `env::ecrecover`), recovers that signer. `model_id` is stored in the contract.
3. The verdict is `ALLOW`.
4. The verdict's `action` equals the canonical bytes of the proposal.
5. The nonce is unused.
6. The action has not expired.
7. It is within the per-transaction and daily caps.
8. The wallet is not frozen.

## Firewall core (Furqaan)

The seam. William's API imports it.

```
judge(mandate_text, action, args_json, context) ->
    { verdict, reason, model, chat_id, req_bytes, resp_bytes, signature, signer }

proposeOnChain(action, args_json) -> { proposal_id, near_tx_hash }

executeOnChain(proposal_id, req_bytes, resp_bytes, signature) -> { near_tx_hash, ok, error? }
```

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
| `POST /api/propose` | `{ mandate_id, action, args, context }` | `{ proposal_id }` |
| `GET /api/proposals` | `?since=ts` | `[ Proposal ]` |
| `GET /api/proposals/:id` | | `Proposal` |
| `GET /api/redteam/latest` | | `{ attacks_blocked, attacks_total, benign_denied, benign_total, cases[] }` |

```
Proposal = {
  id, created_at, action, args, context_excerpt,
  status: "pending" | "allowed" | "denied" | "executed" | "failed",
  verdict, reason, model, chat_id, signature, signer, attestation_url,
  near_tx_hash?,
  oneclick?: { deposit_address, status, dest_tx_hash? },
}
```

## Open

- Nothing. The signature scheme (ECDSA through `env::ecrecover`) and the model (`Qwen/Qwen3.8-27B`) were settled on 1 November.
- Proposed, awaiting both owners: [`execute` checks the signed request](./decisions/2026-11-01-execute-checks-the-signed-request.md), [the seam as factories](./decisions/2026-11-01-firewall-core-seam-and-near-api-js.md), [the converted amount](./decisions/2026-11-01-model-sees-converted-amount.md).

## Revision

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-01 | Furqaan | Copied from §5 of the build plan, unchanged |
| 2026-11-01 | Furqaan, William | Check 2 uses NEAR AI's signed text with the model id; signature scheme ECDSA through `env::ecrecover`; model Qwen3.8-27B. Records: [signed text](./decisions/2026-11-01-accept-model-id-signed-text.md), [go on Qwen](./decisions/2026-11-01-go-intented-on-qwen.md) |
