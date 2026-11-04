# The API judges any factory wallet's proposals, and the agent sends its own transactions

2026-11-04 · Decided by William · Status: proposed (it adds an endpoint and a `Proposal` field to the interface spec, so it needs Furqaan's agreement)

## Context

- **Wallets from the factory can't pay yet.** Since 4 November `intented.testnet` makes wallets in one signed call, and the web app's `/create` page calls it ([factory as built](./2026-11-04-factory-as-built.md)). A wallet made that way is its own agent: the owner adds a function-call key that can call only `propose` and `execute`. The API, though, judges payments for `intented-wallet.testnet` only.
- **Today's path needs the agent's key.** On that path `POST /api/propose` judges the payment and then sends `propose` and `execute` itself, with `AGENT_PRIVATE_KEY` for `intented-agent.testnet`. That can't extend to other wallets: their agent keys belong to their owners, and the API should hold none of them. Furqaan agreed to this direction, which we've called Option 2: the agent keeps its own key and sends its own transactions, and the API only judges.
- **NEAR AI calls cost money.** Whatever the API judges for anyone else has to be bounded.
- **First test.** On 4 November William created `william-test-1104.intented.testnet` through `/create`. Read back from the chain, it has the right owner, code hash, mandate hash, signer and agent key. It can't get a verdict.

## Decision (proposed)

**The agent proposes first, then asks for a verdict on that proposal.**

1. The agent calls `propose(action, args_json)` on its wallet with its own key and gets the `proposal_id`.
2. It calls a new `POST /api/verdict` with `{ wallet_id, proposal_id, context }`. The action and args aren't in the body; the API reads them from the chain.
3. The API returns the signed verdict, and the agent calls `execute` itself, ALLOW or DENY. The wallet's refusal of a DENY stays the proof, as on today's path.

**What `POST /api/verdict` checks before it spends a NEAR AI call:**

- `wallet_id` is `intented-wallet.testnet` or `<label>.intented.testnet`. Only the factory can create accounts under `intented.testnet`, so the name alone says the factory made it. Anything else is a `400`.
- `get_config`: the wallet isn't frozen, and its model and prompt hash are the ones this API's firewall core uses. The API looks up the mandate text whose sha256 is the wallet's `mandate_hash` in its own store, the same store `GET /api/mandates/:text_hash` reads. If any of these fail, the answer is a `409` with the reason.
- `get_proposal(proposal_id)` exists and is pending, and its `expiry_ms` is at least 60 seconds away, so the agent has time to execute. If not, a `409`.
- `context` has the same limits as on `POST /api/propose`, and it is quoted in the prompt as untrusted data, as everywhere else.
- **Rate limit:** at most 30 verdicts per wallet per hour, then a `429` with `Retry-After`. On top of that, each verdict needs a real pending proposal, which costs the wallet's own key gas, and a wallet holds at most 32 pending at a time.

**Only once per proposal.** A second request for the same wallet and `proposal_id` gets the stored answer back, with no second NEAR AI call.

**What it returns:** `{ id, verdict, reason, model, chat_id, signer, signature, req_bytes, resp_bytes }`. `req_bytes` and `resp_bytes` are base64, ready for `execute(proposal_id, req_bytes, resp_bytes, signature)`. The API stores the proposal like any other and settles it from the wallet's record (`get_proposal`'s status) into `executed`, `denied` or `failed`.

**`Proposal` gains `wallet_id`**, and `GET /api/proposals` takes `?wallet=` to list one wallet's proposals. Proposals made on today's path get `intented-wallet.testnet`. On the new path `near_tx_hash` stays empty: the agent sent the transaction, and the API only reads the outcome.

**NEAR-native payments only.** A payment through 1Click still goes through today's path for the demo wallet. On the new path it would need a quote step before `propose`. That is left for later, in line with the cut list, where the cross-chain leg is cut before the NEAR-native payment.

**The demo wallet switches once the new path works.** Today's `POST /api/propose` path stays until then, so the demo and the attack recording keep working. Then the demo agent sends its own `propose` and `execute` with its own key, and `AGENT_PRIVATE_KEY` is removed from the API, before feature-complete on 10 November. A new record will cover that switch and whether `POST /api/propose` goes.

## Consequences

- **What doesn't change:** the contract, the firewall core and the judge request. `judge()` is called as it is today, and every `execute` check applies unchanged. The trust rule holds: no verdict, no execution.
- **The API holds no key for these wallets.** It can't move their money or send their transactions. After the switch, it holds no agent key at all.
- **NEAR AI calls are bounded.** Each one costs an on-chain proposal from a factory wallet's own key. There are at most 32 pending per wallet and 30 verdicts per wallet per hour, and nothing is judged twice.
- **The mandate text must be in the API's store.** `/create` posts it before the owner signs, and the rules page does the same. A wallet whose rules were set some other way gets a `409` until its text is posted to `POST /api/mandate`.
- **Visible to the agent:** the verdict request is public, so anyone can ask for a verdict on a pending proposal of any factory wallet. They get the same signed answer the wallet's agent would. It's useless to them, because only the wallet's own key can call `execute`, and the request costs a NEAR AI call only once per proposal.
- **The agent needs a client:** propose, ask for the verdict, execute. That is William's `intented.pay()`, along with `intented init`, which makes the agent's key pair where the agent runs. It is not part of the spec.
- **Spec changes when both agree:**
  - a `POST /api/verdict` row;
  - `wallet_id` on `Proposal`;
  - `?wallet=` on `GET /api/proposals`;
  - a revision row.
