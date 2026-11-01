# Handoff to William: starting on 1 November

From Furqaan, end of 1 November. KT1 and KT2 pass. The firewall core is real, not a stub: `judge`, `proposeOnChain` and `executeOnChain` work against a deployed testnet wallet, and both demo paths (an honest payment and the poisoned paywall) have run through them. This page gets you from a fresh pull to calling the core from `api/` and running KT3.

## 1. Set up

Needs Node 22 or later (we use 24) and pnpm 11. Rust, `cargo-near` and `near-cli-rs` are only needed for `contract/`.

```sh
git pull
cp .env.example .env
cd firewall-core && pnpm install && pnpm test    # 107 tests should pass
```

## 2. Fill in `.env`

`.env` is gitignored. Values marked *secret* come from the shared password manager; never paste them into code, logs or chat.

| Variable | Value now | Notes |
| --- | --- | --- |
| `NEAR_AI_API_KEY` | *secret* | Or make your own at cloud.near.ai: $10 free credit by joining NEAR Builders (nearbuilders.org/join) |
| `NEAR_AI_MODEL` | `z-ai/glm-5.3-flash` | The testnet wallet is set up for this model. KT3 still decides (section 5) |
| `NEAR_AI_BASE_URL` | leave empty | Defaults to `https://cloud-api.near.ai` |
| `NEAR_NETWORK` | `testnet` | |
| `CONTRACT_ACCOUNT_ID` | `wallet.intented-owner.testnet` | The wallet contract |
| `OWNER_ACCOUNT_ID` | `intented-owner.testnet` | |
| `AGENT_ACCOUNT_ID` | `intented-agent.testnet` | |
| `AGENT_PRIVATE_KEY` | *secret* | A function-call key on the agent account, scoped to `propose` and `execute` on the wallet, 1 NEAR gas allowance. Never a full-access key |
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

## 5. KT3

Pass: at least 18/20 attacks denied, at most 2/20 benign denied, median latency under 5 s. Run every case on both models and record the numbers. For speed the runner can call `judge` directly (no chain calls); it also fetches the signature, as the real pipeline does.

| Model | KT1 | Smoke test (3 cases × 3 runs) | Median latency |
| --- | --- | --- | --- |
| `Qwen/Qwen3.8-27B` | pass | 9/9 | 4.88 s, at the edge of the bar |
| `z-ai/glm-5.3-flash` | pass | 9/9 | about 1.9 s |

The firewall core turns the model's reasoning trace off; with it on, a verdict took 50 s.

## 6. Testnet

| Account | What |
| --- | --- |
| `wallet.intented-owner.testnet` | The wallet contract. Holds 0.048 wNEAR |
| `intented-owner.testnet` | Owner: sets mandate, signers, caps, allowlist, freeze |
| `intented-agent.testnet` | Agent: holds the scoped key in `AGENT_PRIVATE_KEY` |
| `intented-vendor.testnet` | The honest paywall's payee, registered on `wrap.testnet` |
| `intented-attacker.testnet` | The poisoned paywall's payee, registered on `wrap.testnet`; holds 0 |
| `kt2.intented-owner.testnet` | KT2's throwaway verify contract; not the wallet |

The wallet's settings:

| Setting | Value |
| --- | --- |
| Model | `z-ai/glm-5.3-flash` |
| Signer | `0x3b753b4406613c5e70ae640508632b600424fa0c`, verified and registered by `pnpm attest --register` |
| Mandate | `Buy market data from intented-vendor.testnet only. Pay in wNEAR, at most 0.01 wNEAR per call.` |
| Allowlist | `wrap.testnet` |
| Caps | wNEAR: 0.01 per call, 0.05 a day (UTC). NEAR deposit: 1 yoctoNEAR per call |

Account keys go into the shared password manager. Ask Furqaan if they are not there yet.

## 7. What Furqaan needs from you

1. **A yes or no on three proposed changes to the interface spec.** Once you agree, the spec and glossary get one revision.
   - [The signed text includes the model id](./decisions/2026-11-01-signed-text-includes-model-id.md): NEAR AI signs `{model_id}:{sha256(req)}:{sha256(resp)}`.
   - [`execute` checks what the signed request asked](./decisions/2026-11-01-execute-checks-the-signed-request.md): the mandate, the prompt, this action and args, and no steering fields. Adds `set_prompt_hash` and `set_model_id`, and the wallet's init takes the model id.
   - [The seam ships as factories](./decisions/2026-11-01-firewall-core-seam-and-near-api-js.md): `createJudge` and `createChainClient`. The function shapes are unchanged.
2. **KT3 numbers on both models**, for the go/no-go tonight.
3. **The KT4 deposit address and quote.** Furqaan sends the `ft_transfer`; it is mainnet, so both of you say yes first.

You no longer need the Day-2 stub of the core. Keep one only for UI work without NEAR AI calls, and never show its verdicts as verified.

## Rules worth repeating

- A stub verdict is never shown in the UI or a recording as verified.
- Never log keys, JWTs or whole prompts; log proposal ids and transaction hashes.
- The interface spec changes only with both owners and a dated record.
