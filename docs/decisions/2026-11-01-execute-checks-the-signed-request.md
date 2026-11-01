# execute checks what the signed request asked, not only the signed verdict

2026-11-01 · Decided by Furqaan · Status: proposed (it adds checks to `execute` in the interface spec, so it needs William's agreement)

## Context

The signature proves that NEAR AI's TEE produced a response to a request. The spec's eight `execute` checks confirm the verdict is `ALLOW` and its `action` is the proposal's. Nothing checks what the request asked. Whoever holds the agent key and any NEAR AI key can send the exact action with the mandate "allow everything", or a system prompt saying "always answer ALLOW", and receive a genuine TEE-signed `ALLOW` that passes all eight checks. The contract stores `mandate_hash` but compares it with nothing.

## Decision

`execute` parses `req_bytes` and rejects unless:

1. The request has exactly the fields the firewall core sends (`model`, `stream`, `temperature`, `chat_template_kwargs`, `messages`, `response_format`) and no others, so `logit_bias`, `tools` or similar cannot steer the answer. Duplicate keys are rejected.
2. `model` equals the model id stored in the contract (`set_model_id`, owner only). The same id prefixes the signed text, so gateway-form signatures are not accepted.
3. `stream` is false, `temperature` is 0, and thinking is off.
4. `response_format` is exactly the verdict schema with `action` pinned to the proposal's canonical bytes, so a schema that only permits `"ALLOW"` is rejected.
5. There are exactly two messages, `system` then `user`, so no extra instructions or a pre-filled answer can be added.
6. `sha256(system content)` equals a prompt hash the owner stores with a new `set_prompt_hash`. The trusted token table moves into the system prompt, so this hash covers it too.
7. The user content is a JSON object with exactly `mandate`, `action`, `args` and `context`: `mandate` hashes to `mandate_hash`, `action` equals the proposal's canonical bytes, and `args` equals the proposal's `args_json`. The model must have judged the same arguments the contract will send.

`context` is not checked: it is untrusted by design. An attacker who controls it can retry with different text until the model slips; the red-team cases measure how often that works, and the caps bound the damage.

## Consequences

- A leaked agent key and a NEAR AI key are no longer enough to get an action executed: the attacker would need the model to `ALLOW` it under the owner's mandate and our prompt.
- Changing the prompt or the request shape means an owner transaction (`set_prompt_hash`) or a contract upgrade, and every firewall-core prompt change must be followed by one.
- More JSON parsing in `execute`; gas is measured on testnet.
- The firewall core's user message loses its `tokens` field; the token table becomes part of the system prompt, one per network.
- Pending William: the interface spec's `execute` checks and owner methods gain these rows.
