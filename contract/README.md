# contract

The wallet contract and the factory, in Rust with near-sdk. **Owner: Furqaan.**

The wallet holds the agent's funds. It sends a payment only when that payment comes with an `ALLOW` verdict from NEAR AI Cloud, signed by an allowlisted signer, over the exact request and response, for byte for byte the action being executed, within the wallet's hard limits. The contract does not verify the TEE attestation: that report is checked off-chain, and only then is the signer allowlisted ([trust model](../docs/decisions/2026-11-01-signed-verdict-trust-model.md)). The shared interface is in [`docs/interface-spec.md`](../docs/interface-spec.md).

| Folder | What it is |
| --- | --- |
| [`wallet/`](./wallet) | The wallet contract: `propose`, `execute`, the owner's controls. Request and verdict checks in [`src/judged.rs`](./wallet/src/judged.rs), 1Click quote checks in [`src/quote.rs`](./wallet/src/quote.rs) |
| [`factory/`](./factory) | Makes a configured wallet in one call the owner signs. Deployed at `intented.testnet` |
| [`kt2-verify/`](./kt2-verify) | The Day-1 kill test (KT2): signature recovery on a real NEAR AI verdict ([record](../docs/decisions/2026-11-01-kt1-kt2-pass.md)) |

## How a payment goes through

**`propose(action, args_json)`**, agent only, stores the action and returns its id. It refuses:
- a method longer than 64 characters or not an identifier;
- `args_json` over 2048 bytes, or not hashing to `action.args_sha256`;
- a call to the wallet itself;
- an expiry more than an hour ahead;
- a 33rd pending proposal.

**`execute(proposal_id, req_bytes, resp_bytes, sig_65)`**, agent only, runs these checks in order. Any failure panics, and nothing is sent.

1. The proposal exists and is pending, and the wallet is not frozen.
2. The receiver is on the allowlist, the nonce is unused, and the action hasn't expired.
3. **The request** ([`check_request`](./wallet/src/judged.rs)) is exactly what the firewall core sends for this proposal:
   - the wallet's model, temperature 0, no streaming, thinking off;
   - the verdict schema pinned to this action;
   - two messages: a system prompt whose sha256 is the registered prompt hash, and a user message whose mandate hashes to the registered `mandate_hash`, with this action, these args, and the amount as the wallet formats it.

   Any other field, or a duplicate one, fails to parse.
4. **A payment to another chain** (when the request carries `cross_chain`) is checked too:
   - cross-chain payments are on, and the method is `ft_transfer` to the quote's deposit address;
   - the recipient is on the wallet's cross-chain list, if it has one;
   - the action expires before the quote's deadline;
   - 1Click's quote signature verifies with the registered 1Click key, and the signed quote is for exactly this payment: `EXACT_OUTPUT`, not dry, no deposit memo, this recipient, this destination asset, this token, `amountIn` equal to `args.amount`, refunds to this wallet, and `amount_out` starting with the quote's `amountOutFormatted`.
5. **The verdict** ([`check_verdict`](./wallet/src/judged.rs)): exactly one choice; valid verdict JSON; for this action; reason of at most 280 characters; verdict `ALLOW`.
6. **The signature.** The wallet rebuilds `"{model}:{sha256(req)}:{sha256(resp)}"`, recovers the EIP-191 signer from `sig_65`, and requires it to be allowlisted.
7. **The caps.** The attached NEAR, and the `amount` of an `ft_transfer` or `ft_transfer_call`, are checked against the per-transaction cap and the UTC-day cap for that asset.

Only then is the nonce marked used and the call sent. `on_executed` records whether it succeeded. The model can only tighten what these limits permit, never loosen them.

## The owner's controls

All owner only.
- **Rules and judge:** `set_mandate` (a sha256), `set_prompt_hash`, `set_model_id`, `register_signer`, `revoke_signer`.
- **Where money can go:** `allow_receiver`, `disallow_receiver`, `set_token` (symbol, decimals, caps), `set_near_caps`.
- **Cross-chain:** `set_cross_chain`, `allow_cross_chain_recipient`, `disallow_cross_chain_recipient`, `set_one_click_key`.
- **Money and keys:** `withdraw` (NEAR or a token), `add_agent_key` (a function-call key limited to `propose` and `execute`, with a gas allowance), `remove_agent_key`, `freeze`, `unfreeze`.

`prune` deletes proposals: anyone can prune finished or expired ones, and the owner can also prune pending ones. Views: `get_proposal`, `get_config`, `get_token`, `is_frozen`.

## The factory

`create(name, model_id, setup, agent_key, agent_allowance)` builds `<name>.intented.testnet` in one batch:
1. create the account and fund it with the attached NEAR (at least `get_min_deposit()`);
2. deploy the wallet code and call `new_with`, with the caller as owner and the rules, signer, prompt hash, token and caps from `setup`;
3. if a key is given, add the agent's key, limited to `propose` and `execute` on the wallet.

It adds no full-access key, so nobody can replace a factory wallet's contract. If the batch fails, the deposit goes back to the caller.
- `get_code_hash` returns the code every factory wallet runs, so it can be compared with a wallet's `code_hash`.
- `get_wallets(owner_id)` lists an owner's wallets.
- `set_code` changes the code for new wallets only, and only the factory account can call it.

There is no mainnet factory. Mainnet wallets are deployed with the script below.

## Build and test

Needs Rust and [cargo-near](https://github.com/near/cargo-near).

```sh
cd wallet  && cargo test   # 57 tests
cd factory && cargo test   # 9 tests
cd kt2-verify && cargo test
```

The wallet tests cover what `execute` must refuse:
- an unknown signer;
- one flipped byte in the request or response;
- `DENY`;
- a different action;
- a reused nonce;
- an expired action;
- over a cap;
- frozen.

They also cover canonical bytes (fixtures shared with the firewall core), amount formatting, the owner's controls, the agent key, `propose`, `prune` and `withdraw`.

**Reproducible build.** `cargo near build reproducible-wasm` in `wallet/` builds inside the Docker image pinned in [`wallet/Cargo.toml`](./wallet/Cargo.toml), so anyone can rebuild the deployed wasm and compare hashes. `intented-wallet.near`'s `code_hash` `ACiQacTBTZBJSbgqgLjS28ZzqyCesSDXGMduiuANETFw` matches this build at commit `686315b`, the commit its `contract_source_metadata` names ([record](../docs/decisions/2026-11-09-mainnet.md)).

## Deploy one wallet

[`wallet/scripts/deploy-wallet.sh`](./wallet/scripts/deploy-wallet.sh) deploys and configures one wallet, as `intented-wallet.testnet` and `intented-wallet.near` were. In order, it:
1. builds the contract and deploys it with `new`;
2. as the owner, sets the prompt hash, the token and its caps, the receiver allowlist, the NEAR caps and, optionally, the mandate;
3. verifies the model's TEE attestation off-chain and registers its signer (`pnpm attest --register` in [`firewall-core`](../firewall-core/README.md)).

It needs:
- near-cli-rs, with the wallet's and the owner's keys in its keychain;
- cargo-near and pnpm;
- `NEAR_AI_API_KEY` in the repo's `.env`;
- the variables named in its header.

On mainnet it also needs `CONFIRM_MAINNET=yes` and, in this project, a yes from both owners.

A wallet deployed this way keeps the full-access key it was deployed with, and whoever holds that key can replace the contract. For `intented-wallet.near` that holder is William, and the root README says so.
