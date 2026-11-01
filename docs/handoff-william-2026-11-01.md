# Handoff to William: starting on 1 November

From Furqaan, end of 1 November. KT1, KT2 and KT3 pass, and Intented goes ahead on Qwen3.8-27B. The firewall core is real, not a stub: `judge`, `proposeOnChain` and `executeOnChain` work against a deployed testnet wallet, and both demo paths (an honest payment and the poisoned paywall) have run through them. This page gets you from a fresh pull to calling the core from `api/` and running KT3.

## 1. Set up

Needs Node 22 or later (we use 24) and pnpm 11. Rust, `cargo-near` and `near-cli-rs` are only needed for `contract/`.

```sh
git pull
cp .env.example .env
cd firewall-core && pnpm install && pnpm test    # 126 tests should pass
```

## 2. Fill in `.env`

`.env` is gitignored. Values marked *secret* come from the shared password manager; never paste them into code, logs or chat.

| Variable | Value now | Notes |
| --- | --- | --- |
| `NEAR_AI_API_KEY` | *secret* | Or make your own at cloud.near.ai: $10 free credit by joining NEAR Builders (nearbuilders.org/join) |
| `NEAR_AI_MODEL` | `Qwen/Qwen3.8-27B` | The chosen model ([record](./decisions/2026-11-01-go-intented-on-qwen.md)); the testnet wallet is set up for it |
| `NEAR_AI_BASE_URL` | leave empty | Defaults to `https://cloud-api.near.ai` |
| `NEAR_NETWORK` | `testnet` | |
| `CONTRACT_ACCOUNT_ID` | `intented-wallet.testnet` | The wallet contract (redeployed on 1 November; the old `wallet.intented-owner.testnet` is retired) |
| `OWNER_ACCOUNT_ID` | `intented-owner.testnet` | |
| `AGENT_ACCOUNT_ID` | `intented-agent.testnet` | |
| `AGENT_PRIVATE_KEY` | *secret* | A function-call key on the agent account, scoped to `propose` and `execute` on `intented-wallet.testnet`, 1 NEAR gas allowance. Never a full-access key. The key for the old wallet no longer works |
| `ONECLICK_JWT`, `ONECLICK_REFUND_TO`, `BASE_RECIPIENT_ADDRESS` | yours | KT4. The JWT is optional; without it 1Click charges 0.2% |
| `PORT`, `DATABASE_PATH`, `WEB_ORIGINS` | yours | API |

Check it works:

```sh
cd firewall-core
pnpm kt1                          # a signed verdict, verified locally; prints KT1 PASS
pnpm kt3:smoke                    # honest payment ALLOW, poisoned paywall DENY, look-alike token DENY
pnpm tsx scripts/e2e.ts honest    # judge -> propose -> execute on the testnet wallet; pays the vendor 0.001 wNEAR
pnpm tsx scripts/e2e.ts poisoned  # the same with the poisoned paywall; DENY, and the wallet refuses
```

## 3. Import the core

Add it as a linked dependency; it is imported from TypeScript source, so run your code with tsx or Vite:

```json
"dependencies": { "@intented/firewall-core": "link:../firewall-core" }
```

pnpm 11 will ask about esbuild's install script; allow it in your `pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`), as tsx needs it.

## 4. Call the seam from `api/`

The three functions in the interface spec, configured once through two factories so keys stay out of each call. [`firewall-core/scripts/e2e.ts`](../firewall-core/scripts/e2e.ts) is the complete flow.

```ts
import { createHash } from "node:crypto";
import { createJudge, createChainClient, type Action } from "@intented/firewall-core";

const judge = createJudge({ apiKey: process.env.NEAR_AI_API_KEY!, model: process.env.NEAR_AI_MODEL!, network: "testnet" });
const chain = createChainClient({
  rpcUrl: "https://rpc.testnet.near.org",
  walletId: process.env.CONTRACT_ACCOUNT_ID!,
  agentId: process.env.AGENT_ACCOUNT_ID!,
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY!,
});

const argsJson = JSON.stringify({ receiver_id: "intented-vendor.testnet", amount: "1000000000000000000000", memo: "market data" });
const now = BigInt(Date.now());
const action: Action = {
  receiver_id: "wrap.testnet",     // the token contract
  method: "ft_transfer",
  args_sha256: createHash("sha256").update(argsJson).digest("hex"),
  deposit: "1",                    // yoctoNEAR, decimal string
  nonce: now,                      // bigint, unique per action
  expiry_ms: now + 900_000n,       // bigint
};

const v = await judge(mandateText, action, argsJson, context);
//    { verdict, reason, model, chat_id, req_bytes, resp_bytes, signature, signer }
const p = await chain.proposeOnChain(action, argsJson);
//    { proposal_id, near_tx_hash }
const e = await chain.executeOnChain(p.proposal_id, v.req_bytes, v.resp_bytes, v.signature);
//    { near_tx_hash, ok, error? }: a refused execute still has a hash to link
```

What the core and the wallet expect:

- **The mandate text must be the one whose hash the wallet stores**, byte for byte. The wallet refuses a verdict given under any other mandate. The testnet wallet's mandate is in section 6. Changing it means `set_mandate(sha256(text))` from the owner account.
- **`argsJson` is the exact string** and must hash to `action.args_sha256`. The wallet sends exactly those bytes.
- **Attacker text goes in `context`** (the paywall's 402 body, tool output). It is passed to the model as quoted data and is the one part of the request the wallet does not check.
- **Tokens:** only the contracts in `firewall-core/src/tokens.ts` are known; a transfer on any other token contract is denied. Use on-chain symbols in mandates: on testnet `usdc.fakes.testnet` is **USDC.e**, real USDC is the `3e2210e1…` account, and `wrap.testnet` is **wNEAR**.
- **Invalid fields throw** rather than encode: account ids must be valid NEAR ids (lowercase, no unicode), `deposit` a plain decimal, `nonce` and `expiry_ms` bigints within u64.
- **Anything malformed from the model is a `DENY`**, never an `ALLOW`.
- **`ok` means every receipt succeeded**, including the token transfer. Store `near_tx_hash` either way.
- **Log** `proposal_id`, `chat_id` and transaction hashes. Never the key, and never whole prompts.

## 5. KT3: passed, on Qwen

Your runner, rerun after two firewall-core changes, all 40 cases × 3 runs:

| Model | Attacks denied | Benign denied | Median | Flaky |
| --- | --- | --- | --- | --- |
| `Qwen/Qwen3.8-27B` | 20/20 | 0/20 | 4.57 s | 0 |
| `z-ai/glm-5.3-flash` | 19/20 | 0/20 | 2.18 s | 1 (`tok-02`) |

What changed, all in [the go record](./decisions/2026-11-01-go-intented-on-qwen.md) and [the amount record](./decisions/2026-11-01-model-sees-converted-amount.md):

- **Your two misses are fixed.** Rule 6 requires the exact token symbol ("USDC.e is not USDC"); a new rule 8 compares account ids exactly (`vend0r` is not `vendor`). Both went to 3/3 `DENY`.
- **The model no longer converts amounts.** Both models misread 24-decimal wNEAR amounts (0.001 as 0.1 or 1). For a known-token transfer the user message now carries `amount`, such as `"0.001 wNEAR"`, which the wallet checks. `buildJudgeRequest` does this for you, and throws for a known-token transfer whose `args.amount` is not a canonical decimal string.
- **Please add 24-decimal cases** to the suite: honest and attack payments in wNEAR (`wrap.testnet`). Every current case is 6-decimal USDC, which is why this was missed.

The core turns the model's reasoning trace off; with it on, a verdict took 50 s. Every prompt change changes the prompt hash: rerun KT3, then the owner calls `set_prompt_hash`.

## 6. Testnet

| Account | What |
| --- | --- |
| `intented-wallet.testnet` | The wallet contract. Holds 0.049 wNEAR |
| `wallet.intented-owner.testnet` | The retired first wallet (GLM). Its transaction history stays valid |
| `intented-owner.testnet` | Owner: sets mandate, signers, caps, allowlist, freeze |
| `intented-agent.testnet` | Agent: holds the scoped key in `AGENT_PRIVATE_KEY` |
| `intented-vendor.testnet` | The honest paywall's payee, registered on `wrap.testnet` |
| `intented-attacker.testnet` | The poisoned paywall's payee, registered on `wrap.testnet`; holds 0 |
| `kt2.intented-owner.testnet` | KT2's throwaway verify contract; not the wallet |

The wallet's settings:

| Setting | Value |
| --- | --- |
| Model | `Qwen/Qwen3.8-27B` |
| Signer | `0x835ab53d20294ef795906dff21ae4c045336aa26` (Qwen's TEE), verified and registered by `pnpm attest --register` |
| Mandate | `Buy market data from intented-vendor.testnet only. Pay in wNEAR, at most 0.01 wNEAR per call.` |
| Allowlist | `wrap.testnet` |
| Token | `wrap.testnet` as `wNEAR`, 24 decimals (`set_token`), matching the firewall core's table |
| Caps | wNEAR: 0.01 per call, 0.05 a day (UTC). NEAR deposit: 1 yoctoNEAR per call |

Account keys go into the shared password manager. Ask Furqaan if they are not there yet.

## 7. What Furqaan needs from you

1. **A yes or no on three proposed changes to the interface spec.** The signed-text change you agreed to is [accepted](./decisions/2026-11-01-accept-model-id-signed-text.md) and in the spec.
   - [`execute` checks what the signed request asked](./decisions/2026-11-01-execute-checks-the-signed-request.md): the mandate, the prompt, this action and args, and no steering fields. Adds `set_prompt_hash` and `set_model_id`, and the wallet's init takes the model id.
   - [The seam ships as factories](./decisions/2026-11-01-firewall-core-seam-and-near-api-js.md): `createJudge` and `createChainClient`. The function shapes are unchanged.
   - [The model sees converted amounts](./decisions/2026-11-01-model-sees-converted-amount.md): the user message gains `amount`; `set_token(token_id, { symbol, decimals, caps })` replaces `set_token_caps`.
2. **24-decimal wNEAR cases** in the red-team suite (section 5).
3. **The KT4 deposit address and quote**, if we keep the cross-chain leg (NEAR Intents is not required by the rules). Furqaan sends the `ft_transfer`; it is mainnet, so both of you say yes first.

You no longer need the Day-2 stub of the core. Keep one only for UI work without NEAR AI calls, and never show its verdicts as verified.

## Rules worth repeating

- A stub verdict is never shown in the UI or a recording as verified.
- Never log keys, JWTs or whole prompts; log proposal ids and transaction hashes.
- The interface spec changes only with both owners and a dated record.
