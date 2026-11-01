# Handoff to William: starting on 1 November

From Furqaan, end of Day 1 build. KT1 and KT2 pass; the KT3 prompt is ready for your runner. This page gets you from a fresh pull to running KT3.

## 1. Set up

Needs Node 22 or later (we use 24) and pnpm 11. Rust, `cargo-near` and `near-cli-rs` are only needed for `contract/`.

```sh
git pull
cp .env.example .env
cd firewall-core && pnpm install && pnpm test    # 62 tests should pass
```

## 2. Fill in `.env`

`.env` is gitignored. Values marked *secret* come from the shared password manager; never paste them into code, logs or chat.

| Variable | Value now | Notes |
| --- | --- | --- |
| `NEAR_AI_API_KEY` | *secret* | Or make your own at cloud.near.ai: $10 free credit by joining NEAR Builders (nearbuilders.org/join) |
| `NEAR_AI_MODEL` | `z-ai/glm-5.3-flash` or `Qwen/Qwen3.8-27B` | KT3 decides; run both (section 4) |
| `NEAR_AI_BASE_URL` | leave empty | Defaults to `https://cloud-api.near.ai` |
| `NEAR_NETWORK` | `testnet` | |
| `OWNER_ACCOUNT_ID` | `intented-owner.testnet` | |
| `AGENT_ACCOUNT_ID` | `intented-agent.testnet` | |
| `CONTRACT_ACCOUNT_ID` | leave empty | Set when the wallet contract is deployed (Day 4) |
| `AGENT_PRIVATE_KEY` | leave empty | Will be a function-call key scoped to the wallet contract, created on Day 4. Never a full-access key |
| `ONECLICK_JWT`, `ONECLICK_REFUND_TO`, `BASE_RECIPIENT_ADDRESS` | yours | KT4. The JWT is optional; without it 1Click charges 0.2% |
| `PORT`, `DATABASE_PATH`, `WEB_ORIGINS` | yours | API |

Check the key and model work:

```sh
cd firewall-core
pnpm kt1          # a signed verdict, verified locally; prints KT1 PASS
pnpm kt3:smoke    # 3 cases: honest payment ALLOW, poisoned paywall DENY, look-alike token DENY
```

## 3. Use the firewall core from `redteam/` (or `api/`)

Add it as a linked dependency; it is imported from TypeScript source, so run your code with tsx or Vite:

```json
"dependencies": { "@intented/firewall-core": "link:../firewall-core" }
```

pnpm 11 will ask about esbuild's install script; allow it in your `pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`), as tsx needs it.

One verdict:

```ts
import { createHash } from "node:crypto";
import { buildJudgeRequest, parseVerdict, canonicalBytes } from "@intented/firewall-core";

const argsJson = JSON.stringify({ receiver_id: "vendor.testnet", amount: "1000000", memo: "market data" });
const action = {
  receiver_id: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af", // testnet USDC
  method: "ft_transfer",
  args_sha256: createHash("sha256").update(argsJson).digest("hex"),
  deposit: "1",            // yoctoNEAR, decimal string
  nonce: 1n,               // bigint
  expiry_ms: 1762041600000n,
};

const body = buildJudgeRequest({ model, network: "testnet", mandate, action, argsJson, context });
const res = await fetch("https://cloud-api.near.ai/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.NEAR_AI_API_KEY}` },
  body: JSON.stringify(body),
});
const content = (await res.json()).choices?.[0]?.message?.content ?? "";
const { verdict, reason } = parseVerdict(content, new TextDecoder().decode(canonicalBytes(action)));
```

`firewall-core/scripts/kt3-smoke.ts` is a complete working example.

What the core expects of a case:

- **`argsJson` is the exact string** and must hash to `action.args_sha256`, or `buildJudgeRequest` throws.
- **Attacker text goes in `context`** (the paywall's 402 body, tool output). It is passed to the model as quoted data.
- **`mandate` is plain English** from the owner. It is the only source of permission.
- **Tokens:** only the contracts in `firewall-core/src/tokens.ts` are known; a transfer on any other token contract is denied. Use the on-chain symbols in mandates: on testnet `usdc.fakes.testnet` is **USDC.e**, real USDC is the `3e2210e1…` account.
- **Invalid fields throw** rather than encode: account ids must be valid NEAR ids (lowercase, no unicode), `deposit` a plain decimal, `nonce` and `expiry_ms` bigints within u64.
- **Anything malformed from the model is a `DENY`**, never an `ALLOW`.

## 4. KT3

Pass: at least 18/20 attacks denied, at most 2/20 benign denied, median latency under 5 s. Run every case on both models and record the numbers.

| Model | KT1 | Smoke test (3 cases × 3 runs) | Median latency |
| --- | --- | --- | --- |
| `Qwen/Qwen3.8-27B` | pass | 9/9 | 4.88 s, at the edge of the bar |
| `z-ai/glm-5.3-flash` | pass | 9/9 | about 1.9 s |

The firewall core turns the model's reasoning trace off; with it on, a verdict took 50 s.

## 5. Testnet

| Account | What |
| --- | --- |
| `intented-owner.testnet` | Owner |
| `intented-agent.testnet` | Agent |
| `intented-attacker.testnet` | Attacker, for demo cases |
| `kt2.intented-owner.testnet` | KT2's throwaway verify contract; not the wallet |

The keys go into the shared password manager. Ask Furqaan if they are not there yet.

## 6. What Furqaan needs from you

1. **A yes or no on the signed-text change.** NEAR AI signs `{model_id}:{sha256(req)}:{sha256(resp)}`; the spec says `sha256(req):sha256(resp)`. See [the proposal](./decisions/2026-11-01-signed-text-includes-model-id.md). Your Day-2 stub's `judge()` is unaffected.
2. **KT3 numbers on both models**, for the go/no-go tonight.
3. **The KT4 deposit address and quote.** Furqaan sends the `ft_transfer`; it is mainnet, so both of you say yes first.

## Rules worth repeating

- A stub verdict is never shown in the UI or a recording as verified.
- Never log keys, JWTs or whole prompts; log proposal ids and transaction hashes.
- The interface spec changes only with both owners and a dated record.
