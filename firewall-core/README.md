# firewall-core

The TypeScript library that gets a signed verdict from NEAR AI Cloud and submits it to the wallet, plus the attestation checker that decides which signer the wallet trusts. **Owner: Furqaan.**

The API judges with it, and the agent sends its own transactions with it. The API holds no NEAR key. The shared interface is in [`docs/interface-spec.md`](../docs/interface-spec.md).

## What it exports

| Export | File | What it does |
| --- | --- | --- |
| `canonicalBytes(action)` | [`src/canonical.ts`](./src/canonical.ts) | The one byte encoding of an action, which the model judges and the wallet rebuilds. Amounts must be canonical decimals, so each action has exactly one encoding |
| `buildJudgeRequest(input)`, `systemPrompt(network)` | [`src/prompt.ts`](./src/prompt.ts) | The chat-completions body for one verdict |
| `createJudge(config)` | [`src/judge.ts`](./src/judge.ts) | `judge(mandate, action, argsJson, context, crossChain?)`: one verdict with its exact bytes and signature |
| `parseVerdict(content, action)` | [`src/verdict.ts`](./src/verdict.ts) | Reads the model's output. Anything but the exact verdict object for this action is a `DENY` |
| `createChainClient(config)`, `outcomeOf` | [`src/onchain.ts`](./src/onchain.ts) | `proposeOnChain` and `executeOnChain`, signed with the agent's function-call key, and reading their outcome |
| `KNOWN_TOKENS` | [`src/tokens.ts`](./src/tokens.ts) | The token contracts the model is told about, per network, with symbol and decimals from each contract's `ft_metadata`. A transfer on any other contract is denied |

## How a verdict is made

1. **The request.** `buildJudgeRequest` refuses args that don't hash to the action's `args_sha256`. It then sends:
   - the system prompt: the rules for judging, and the known tokens;
   - one user message: a JSON object with `mandate`, `action` (canonical), `args`, `context`, the token `amount` in human units for a transfer, and `cross_chain` for a payment through 1Click.

   What the agent read (`context`) goes in only as a string field of that object, never spliced into instructions, and the prompt tells the model it is untrusted. The request asks for temperature 0, no streaming, thinking off, and a strict JSON schema whose `action` must equal this action. The schema puts `reason` before `verdict`, so the model reasons before it decides.
2. **The call** goes to `/v1/chat/completions`. The response bytes are kept exactly as received.
3. **The signature is fetched straight after** from `/v1/signature/{chat_id}`, since signing keys rotate. A 404 is retried up to 5 times, because another node may not have it yet. The judge then checks two things, and throws if either fails:
   - the signed text is `"{model}:{sha256(req)}:{sha256(resp)}"` for these exact bytes;
   - the signature recovers to the `signing_address` NEAR AI returned.
4. **The verdict.** `parseVerdict` returns `ALLOW` only for valid JSON with exactly the keys `verdict`, `reason` and `action`, each once, naming this action. Anything else is a `DENY` with the reason why.

The judge returns the verdict, the reason, the request and response bytes, the signature and the signer. The wallet re-checks all of it on-chain ([contract README](../contract/README.md#how-a-payment-goes-through)). This library's checks don't replace those.

## The attestation checker

`pnpm attest` fetches NEAR AI's attestation report for the model with a fresh nonce, and verifies every model TEE in it off-chain ([`src/attestation.ts`](./src/attestation.ts), following `nearai-cloud-verifier`, but every check must pass):
- the TDX quote against Intel's chain;
- `report_data` binding the signing address and our nonce;
- `mr_config_id` binding the app;
- the GPU evidence through NVIDIA NRAS, with its token's signature, issuer, nonce and expiry checked.

`pnpm attest --register` then allowlists each verified signer on the wallet, as the owner. The contract never sees the quote: it trusts the signers the owner registered after this check.

## Run

Needs Node 22 or later, pnpm, and `.env` at the repo root.

```sh
pnpm install
pnpm test              # 141 tests
pnpm typecheck
pnpm attest            # NEAR_AI_API_KEY, NEAR_AI_MODEL, CONTRACT_ACCOUNT_ID, OWNER_ACCOUNT_ID
pnpm attest --register
pnpm kt1               # KT1: one real signed verdict, verified locally
pnpm kt3:smoke         # one honest and one poisoned case against NEAR AI
```

The tests cover:
- canonical encoding, including large deposits and unicode receiver ids;
- the request and the prompt;
- verdict parsing (anything but the exact object is a `DENY`);
- the judge's signature checks;
- the attestation checks, with a saved TDX quote and Intel's collateral so they run offline;
- the cross-chain field;
- the on-chain calls.

The scripts in [`scripts/`](./scripts) write the fixtures shared with the contract, so both sides are tested on the same bytes:
- `canonical-fixture.ts`: the canonical string for each test action, for the contract's encoder;
- `execute-fixture.ts`: signed verdicts for the wallet's `execute` tests, built with the real `buildJudgeRequest`, each attack changing one thing, signed with a throwaway key;
- `oneclick-quote.ts`: 1Click quote signatures, written separately from the API's code so the two check each other.

`e2e.ts` runs judge → `proposeOnChain` → `executeOnChain` on the testnet wallet.
