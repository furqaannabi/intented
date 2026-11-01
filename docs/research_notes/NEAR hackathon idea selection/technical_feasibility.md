# Technical Feasibility of NEAR Primitives for a Solo 14-Day Hackathon (Nov 1–14, 2026), as of Oct 22, 2026

How to read these notes:
- **[VERIFIED-LIVE]**: I tested it myself against production endpoints on 2026-10-22 (curl from this machine).
- **[DOCS]**: stated in official docs (docs.near-intents.org, docs.near.ai, docs.near.org, outlayer.fastnear.com).
- **[MARKETING]**: stated in a blog post, a tweet or press coverage only.
- **[BACKGROUND]**: my own pre-2026 knowledge that I did not re-check this session. Treat it as a hypothesis.
- Most doc pages were read through a summarizing fetch tool. Exact parameter names quoted below were cross-checked across at least two pages, or against the live API, wherever possible.

---

## 1. Confidential Intents: scope, contract composability, visibility, view keys

### Takeaway
Confidential Intents is real and live, but it is a **swap/transfer/balance product exposed only through the 1Click API**. Under the hood it is a separate permissioned NEAR fork ("FAR") that runs a single predefined `intents.far` contract. I found **no evidence that arbitrary smart-contract logic runs there**, that a third-party contract can hold shielded balances, or that view keys are exposed to third-party apps through an API. Confidential quotes also **require per-user authentication**: a JWT alone is not enough, and I confirmed this live. So any idea that needs "a prediction-market or escrow contract holding confidential balances" cannot be built as specified.

### Cited Findings
- **GA date and claims [MARKETING]:** GA was announced July 7, 2026. Devs add "a confidential parameter" to the existing 1Click Swap API, and "no new infrastructure" or specialized SDK is needed. The product is described as **"cross-chain swaps and transfers"**. Each user's transactions are encrypted individually on a private shard rather than pooled. Users get "an account-level view key" for time-scoped sharing with auditors or tax advisors, and the sharing is user-initiated. "Assets are screened at ingress." About 42% of near.com volume was confidential within weeks, with over $30M in confidential balances — [NEAR blog](https://www.near.org/blog/announcing-general-availability-of-confidential-intents)
- **Changelog dates [DOCS]:** the `confidentiality` quote field shipped Jul 1, 2026. The "Confidential Intents B2B Launch" on Jul 13, 2026 runs swaps "on a private chain with shielded balances, settling back to public NEAR through the Private PoA Bridge". Also on Jul 13, solvers on the confidential relay became **allowlist-only** (WebSocket-only, signed quote responses). On **Aug 28, 2026, 1Click added confidential limit orders**: users can rest confidential swaps at prices they choose — [NEAR Intents changelog](https://docs.near-intents.org/changelog/overview.md)
- **Parameter [DOCS]:** the field is `confidentiality` with values `"basic"` or `"advanced"`. Deposit, recipient and refund types include `ORIGIN_CHAIN`, `DESTINATION_CHAIN` and **`CONFIDENTIAL_INTENTS`**, so a swap can end in a shielded Confidential Intents balance instead of an external address. The page contrasts two models: one where "deposits and withdrawals can be matched to each other" and one where they "cannot be tracked to each other". The extract did not say which mode is which. Recipients that are NEAR contracts are not mentioned — [Confidential swaps quickstart](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps.md)
- **[VERIFIED-LIVE]:** a dry `POST /v0/quote` with `"confidentiality":"basic"` or `"advanced"` and no auth returns `401 "User authentication is required for confidential intent quotes"`. Without the field, the same quote succeeds and echoes `"confidentiality":"public"`. So confidential flows need the end user's signed session (see the user-auth endpoints below), not just a partner key — [1Click API](https://1click.chaindefuser.com/v0/quote)
- **Architecture [DOCS]:** there are two chains. On public NEAR, `intents.near` holds deposited balances. **FAR is "a permissioned NEAR fork operated by a small validator set with no public networking"**, and its RPC is reachable "only through authenticated channels". Shielding sends tokens to a Treasury account on NEAR, and the bridge then mints IMT tokens on FAR with IDs like `imt:<ACCOUNT_ID>:nep141:<token>`. The bridge is "request-driven", meaning it processes deposits and burns through RPC requests rather than watching chain events. Unshielding burns IMT on FAR and releases funds from the Treasury. "Balances and swap details on FAR are not visible to the public." Solvers reach private balances through 1Click using **User-Session tokens**. The docs cover only the predefined `intents.far` contract and say nothing about deploying other contracts — [Confidential Intents (market makers)](https://docs.near-intents.org/integration/market-makers/confidential-intents.md)
- **What stays public [DOCS, from Aurora's Intents docs]:** hidden are the origin wallet, the routing path and the link between source and destination. **Public** are the destination tx, the destination asset and amount, and the recipient on the destination chain. Quote: "Confidential Intents is not private DeFi and does not obscure the destination. Settlement stays auditable." The same page lists "Confidential deposits" and "Confidential DeFi actions" as **"rolling out"**, with only confidential swaps live — [Aurora Intents docs: Confidential Intents](https://docs.intents.aurora.dev/confidential-intents)
- **A third-party wallet already wraps it [DOCS]:** OutLayer's agent-custody wallet has `/wallet/v1/confidential/*` routes on mainnet only. They use the private shard `intents.far`, which has no public RPC. Per OutLayer, "SHIELD/UNSHIELD link wallet identity; cross-chain routes maintain unlinkability." — [OutLayer agent custody docs](https://outlayer.fastnear.com/docs/agent-custody)
- **Explorer visibility [MARKETING]:** "Transaction details remain hidden from public blockchain explorers" — [NEAR blog](https://www.near.org/blog/announcing-general-availability-of-confidential-intents). This is narrower than it sounds once you add the Aurora docs finding above: the destination leg stays visible.
- **User-auth endpoints exist [DOCS]:** "Authenticate User with Signed Data" and "Refresh Access Token" pages are listed — [docs.near-intents.org llms.txt](https://docs.near-intents.org/llms.txt). Aurora's wrapper exposes `/api/authenticate-user-with-signed-data` and `/api/get-user-token-balances` ("optional, for balance reads") — [Aurora confidential swaps](https://docs.intents.aurora.dev/intents-swap/confidential-swaps)
- **Ecosystem integrations [MARKETING]:** the NullMask bridge has a confidential toggle — [NEAR Intents on X](https://x.com/near_intents/status/2108569985564250418)

### Inferences
- **Arbitrary contract logic: no.** FAR is permissioned with no public RPC, and only `intents.far` is documented. A hackathon contract such as a prediction-market escrow cannot live on FAR and cannot hold IMT balances. A NEAR-mainnet contract could only receive *unshielded* public tokens, which breaks privacy at the contract boundary.
- **Confidential payouts to users are possible, but only off-contract.** A backend or agent wallet (for example OutLayer custody) can send a payout as a confidential swap or transfer that ends in `CONFIDENTIAL_INTENTS` for the recipient, or on another chain. The settlement logic itself stays public or off-chain.
- **View keys:** the only evidence is the marketing line "account-level view key… user-initiated". No API for third-party apps to request, verify or consume view keys turned up in the docs index I searched. Treat programmatic view keys as **not available** until NEAR confirms otherwise.
- **The user must sign.** Because confidential quotes need a user session, every confidential flow needs a wallet signature step through the user-auth endpoints. That adds roughly 0.5–1 day of integration work.
- **Limit orders (Aug 28) are the closest primitive to OTC.** Users can rest confidential orders at a chosen price. Solvers are allowlisted, though, so a hackathon app **cannot act as the counterparty or matcher on the confidential relay**.

### Gaps
- What exactly separates `basic` from `advanced` (which one is unlinkable)?
- Is there a `CONFIDENTIAL_INTENTS` → `CONFIDENTIAL_INTENTS` transfer between two users (P2P)? It is implied by OutLayer's `intents/transfer` and confidential routes but not confirmed for 1Click.
- Do view keys have an API? Is there a way to delegate read-only balance access, separate from a full user-session token?
- Can a NEAR contract account be a recipient of a confidential unshield? Can it call `authenticate-user-with-signed-data` (NEP-413 signatures come from keys, not contracts)?
- Which confidential minimums, fees and asset lists apply?

---

## 2. 1Click API: endpoints, auth, SDK, chains, fees, minimums, testnet, latency

### Takeaway
1Click is mature and easy to use. The flow is `GET /v0/tokens` → `POST /v0/quote` (first with `dry:true`, then a real quote) → send funds to the quote's deposit address → `POST /v0/deposit/submit` → `GET /v0/status`. Unauthenticated quotes work, and I confirmed this live. A partner JWT from partners.near-intents.org lowers fees. Today it lists **205 assets on 37 chains** [VERIFIED-LIVE], quotes return in about 1 s, and a $5 USDC Base→Arbitrum route has a 34 s time estimate. There is effectively no usable testnet, so test on mainnet with a few dollars.

### Cited Findings
- **Endpoints and flow [DOCS]:** `GET /v0/tokens → POST /v0/quote (dry) → POST /v0/quote (wet) → Deposit TX → POST /v0/deposit/submit → GET /v0/status` — [NEAR agent-skills: near-intents](https://www.skills.sh/near/agent-skills/near-intents). OpenAPI specs live at `https://1click.chaindefuser.com/docs/v0/openapi.yaml` and `https://explorer.near-intents.org/api/v0/openapi.yaml` — [llms.txt](https://docs.near-intents.org/llms.txt). "Assets move to a quote-specific deposit address and settle on-chain; 1Click does not take custody of them." — [1Click API page](https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api)
- **TypeScript SDK [DOCS]:** `@defuse-protocol/one-click-sdk-typescript` uses base URL `https://1click.chaindefuser.com`. Its `QuoteRequest` takes `dry`, `swapType`, `slippageTolerance`, `originAsset`, `depositType`, `destinationAsset`, `amount`, `refundTo`, `refundType`, `recipient` and `recipientType` — [GitHub one-click-sdk-typescript](https://github.com/defuse-protocol/one-click-sdk-typescript); [unpkg README](https://unpkg.com/@defuse-protocol/one-click-sdk-typescript@0.1.25/README.md)
- **Auth [DOCS]:** get the JWT from the Partner Dashboard at `https://partners.near-intents.org/home`. Send it as `X-API-Key` or `Authorization: Bearer`. Unauthenticated requests pay an **extra 0.25%** on non-`ANY_INPUT` quotes. With a JWT the partner schedule is typically **20 bps**, or **1 bp on stablecoin or same-asset multichain routes**. User-Session tokens are separate, with a short-lived `accessToken` and a `refreshToken`. Signup and approval time are not documented — [Authentication](https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication.md)
- **Fees [DOCS]:** the protocol fee is 0.0001% (1 pip). 1Click charges 0.20% standard with a key, or 0.01% on stablecoin and same-asset routes. When you add `appFees`, the fee is split 50/50, with 1Click keeping at least 20 bps (1 bp on stablecoins). Any price improvement over the quote within about 30 minutes is split 50/50. Withdrawals of NEAR, ZEC or STRK to Solana pay 0.1% — [Fees](https://docs.near-intents.org/resources/fees.md). You can verify quote signatures before trusting `depositAddress` (added Jun 27, 2026) — [Changelog](https://docs.near-intents.org/changelog/overview.md)
- **Minimums [DOCS]:** from Sep 9, 2026, "Temporary $1,000 Quote Minimum": origin→origin swaps under $1,000 were blocked on nine chains (deposits and withdrawals unaffected). From Sep 14, 2026, a temporary $100 minimum applied on Tron. Robinhood Chain (`hood`) was added Sep 18 — [Changelog](https://docs.near-intents.org/changelog/overview.md)
- **[VERIFIED-LIVE] 2026-10-22, run from this machine:**
  - `GET /v0/tokens` returned **205 assets across 37 chains** (near 31, eth 29, sol 22, base 18, aptos 13, bsc 10, gnosis 9, arb 7, op 6, hood 6, plus btc, zec, doge, xrp, ton, tron, sui, stellar, cardano, ltc, aleo, starknet, monad and others). This beats the claimed "30+ chains / 180+ assets".
  - An **unauthenticated dry quote** for 5 USDC Base→Arbitrum succeeded in about 1.0 s: amountOut 4.994 USDC, `timeEstimate: 34` (seconds), `withdrawFee` 0.0053 USDC, `refundFee` 0.0024 USDC.
  - The response echoed new fields: `depositMode: "SIMPLE"`, `confidentiality: "public"`, `insured: false`, `quoteWaitingTimeMs`, and a default `appFees` entry of 1 bp.
  - A 0.10 USDC quote was rejected with `"Amount is too low for bridge, try at least 150000"` (0.15 USDC).
  - So the $1,000 temporary minimum did **not** apply to this route today.
  - [1Click API](https://1click.chaindefuser.com/v0/tokens)
- **Testnet [DOCS, indirect]:** OutLayer says its testnet "lacks Intents solvers (returns HTTP 503)" — [OutLayer agent custody](https://outlayer.fastnear.com/docs/agent-custody). The 1Click docs pages I read do not mention a testnet.
- **Aurora wrapper [DOCS]:** Aurora runs its own Intents API: `POST https://intents-api.aurora.dev/api/quote/${API_KEY}` and `.../api/status/${API_KEY}`, with keys issued from "Widget Studio" at studio.aurora.dev — [Aurora confidential swaps](https://docs.intents.aurora.dev/intents-swap/confidential-swaps)

### Inferences
- **Setup time:** about 2–4 hours to a working non-confidential quote → deposit → status loop with the SDK, plus 0.5–1 day for confidential mode (user-auth signing). Budget about $20–50 of mainnet funds for testing. Small amounts work (minimum about $0.15 on some routes), but check per-route minimums.
- **Latency:** quoting takes about 1 s. Settlement is tens of seconds for EVM L2 to L2 (34 s estimate). Slower origin chains like BTC will take longer; I did not measure them.
- **Get the JWT on day 1.** Signup turnaround is undocumented, and without it the 0.25% surcharge applies.

### Gaps
- Exact current status enum values (e.g. `PENDING_DEPOSIT`, `PROCESSING`, `SUCCESS`, `REFUNDED`): I did not fetch the API reference page.
- Is the Sep 9 $1,000 minimum still active on other chains? Which nine chains?
- How long does Partner Dashboard approval take?
- What does the new `insured` quote field mean?

---

## 3. NEAR AI Cloud: API, models, pricing, attestation, signatures, on-chain verification

### Takeaway
NEAR AI Cloud is a production, OpenAI-compatible gateway at `https://cloud-api.near.ai/v1`. Response signatures are ECDSA (EIP-191, Ethereum-style) or Ed25519 over `sha256(request):sha256(response)`. That makes them **verifiable in a NEAR contract with `ecrecover` or ed25519 verify plus sha256**. Verifying the full TDX quote on-chain is not realistic. Use cheap open-weight models such as Qwen3.8-27B, GLM-5.3-flash or DeepSeek-V4.1-flash for attested verdicts. The many proprietary models in the catalog (Claude, GPT, Gemini) are probably proxied, not TEE-hosted. That is unverified, so do not claim TEE guarantees for them.

### Cited Findings
- **Base URL and compatibility [DOCS]:** `https://cloud-api.near.ai/v1`. Supported: `/chat/completions` (tool calling, structured outputs, reasoning), `/completions`, `/models`, `/embeddings`, `/images/generations` and `/images/edits`, `/audio/transcriptions`, `/responses` (stateless: `store:false` or omit it, client manages history), SSE streaming, plus rerank, privacy-filter and attestation extensions. Keys come from the cloud.near.ai dashboard. The page shows OpenAI Python and JS SDK examples and supports `OPENAI_BASE_URL`. **No Vercel AI SDK or LangChain examples** — [OpenAI compatibility](https://docs.near.ai/cloud/guides/openai-compatibility.md). Official SDKs exist for JS, Python, Rust and Go — [llms.txt](https://docs.near.ai/llms.txt)
- **Infrastructure claim [DOCS]:** "All inference runs inside Intel TDX confidential VMs with NVIDIA TEE GPUs, TLS terminates inside the TEE, and every chat response is signed by a key that never leaves the TEE" — [Chat verification](https://docs.near.ai/cloud/verification/chat/)
- **Attestation endpoint [DOCS]:** `GET /v1/attestation/report` takes the params `model`, `signing_algo` (ecdsa|ed25519), `nonce`, `signing_address`, `include_tls_fingerprint` and `provider` (`near` = NEAR AI TEE fleet, `chutes` = Chutes fallback). It returns `gateway_attestation` (`signing_address`, `signing_algo`, `intel_quote`, `event_log`, `report_data`, `request_nonce`, `tls_cert_fingerprint`, …), `model_attestations[]`, `ohttp_attestation` and `tls_certificate`. It is non-billable — [Get attestation report](https://docs.near.ai/api-reference/attestation/get-attestation-report.md). **[VERIFIED-LIVE]:** it returns 401 without an API key.
- **Signature endpoint [DOCS]:** `GET https://cloud-api.near.ai/v1/signature/{chat_id}?model={model_id}&signing_algo=ecdsa`, where `chat_id` is the `id` from the completion response — [Signature API ref](https://docs.near.ai/api-reference/attestation/get-completion-or-responses-api-signature.md)
- **Signed message format [DOCS]:**
  - Gateway signatures sign `"${sha256(requestBytes)}:${sha256(responseBytes)}"`.
  - Direct model endpoints sign `"${modelName}:${sha256(req)}:${sha256(resp)}"`.
  - ECDSA signatures are 65 bytes and verified with `ethers.verifyMessage`, which applies the EIP-191 personal-sign prefix, against `signing_address`.
  - Ed25519 signatures are 64 bytes and verified with `nacl.sign.detached.verify`.
  - The signer must match the `preflight_signer` from an already-verified attestation report.
  - The docs give Node (ethers v6, tweetnacl) and Python examples.
  - [Response signature verification](https://docs.near.ai/cloud/verification/reference/response-signature-verification.md)
- **Experimental caveat [DOCS]:** verification on the "Direct completions endpoints" is experimental, with known limitations — [Chat verification](https://docs.near.ai/cloud/verification/chat/)
- **Models and pricing [VERIFIED-LIVE]:** `GET /v1/models` (unauthenticated) returned 59 models with pricing in $ per M tokens. Open-weight entries carry `hugging_face_id`, `quantization` and `datacenters:[US]` fields, which suggests NEAR-hosted. Proprietary entries carry `textPricing` tiers instead. Many have `is_ready:false`, including claude-sonnet-4-5/4-6, gemini-2.5-*, deepseek-v3.2 and qwen3.5-397b. Examples marked `is_ready:true` or with no flag:
  - **Qwen/Qwen3.8-27B (FP8): $0.04 in / $1.35 out, 262K context**
  - Qwen/Qwen3.6-35B-A3B-FP8: $0.17 / $1.10
  - z-ai/glm-5.3-flash: $0.08 / $0.50
  - deepseek/deepseek-v4.1-flash: $0.30 / $1.20
  - moonshotai/kimi-k2.6: $0.81 / $3.85
  - moonshotai/kimi-k3: $3.3 / $16.5
  - Qwen3-VL-30B-A3B: $0.15 / $0.55
  - Qwen3-Embedding-0.6B: $0.01
  - whisper-large-v3
  - openai/gpt-5-nano: $0.05 / $0.40
  - anthropic/claude-sonnet-5-5: $2 / $10 (is_ready:true)
  - anthropic/claude-opus-5-5: $4 / $20 (is_ready:true)
  - [cloud-api.near.ai/v1/models](https://cloud-api.near.ai/v1/models)
- **Privacy tiers [DOCS]:** the docs say the "model catalog labels every model with one of three privacy tiers". The live `/v1/models` JSON had **no** tier field, so tiers presumably show in the dashboard UI only — [Models](https://docs.near.ai/cloud/models.md)
- **Agent skill [DOCS]:** NEAR publishes an agent skill for NEAR AI Cloud — [skills.sh near-ai-cloud](https://skills.sh/near/agent-skills/near-ai-cloud)

### Inferences
- **Vercel AI SDK:** `@ai-sdk/openai-compatible` (or `createOpenAI({baseURL})`) should work, since the API is chat-completions compatible with SSE. I found no doc confirmation. Streaming signatures need the final `id` to fetch `/v1/signature/{id}`.
- **On-chain verification is feasible, with a trust shortcut.** A NEAR contract can recompute `sha256(request_bytes)` and `sha256(response_bytes)`, build the EIP-191 message, and `ecrecover` the signer. [BACKGROUND] near-sdk-rs has `env::sha256`, `env::keccak256` and `env::ecrecover`, and also `env::ed25519_verify`. The contract then compares the signer against an allowlisted `signing_address` that an admin or oracle registered after checking the TDX/NVIDIA attestation off-chain. Full quote verification on-chain is too heavy for 14 days. OutLayer is the alternative if you need TEE-attested execution with an on-chain callback.
- **Gotchas:**
  - You must keep the exact request and response bytes. Re-serializing JSON changes the hash.
  - Signing keys can rotate per TEE instance, so the allowlist needs updating.
  - Signature retention time is undocumented, so fetch and store the signature immediately.
- **Setup time:** about 1 hour for OpenAI-compatible chat. About 0.5–1 day for off-chain signature and attestation verification using the doc snippets. About 1–2 more days for an on-chain verifier contract.

### Gaps
- How long are signatures retained? Do the proprietary models (Claude, GPT) return TEE signatures, and is their signing key the gateway's or a model TEE's?
- Can inference be paid in crypto or on-chain (relevant to Pocket Pet)? Only dashboard API keys were documented.
- Are there free credits for hackathon participants?
- Which models are in which privacy tier?

---

## 4. OutLayer: agent custody, policies, approvals, contract yield/resume

### Takeaway
OutLayer (built by FastNEAR) is the most practical "TEE agent wallet" primitive today. It offers REST registration with no on-chain transaction, policies enforced in a TDX enclave, k-of-n approvals via NEP-413 signatures, and built-in Intents (including confidential) routes. It also has a separate contract-callable verifiable compute API (`request_execution` on `outlayer.near`, with a callback). Main limits: **no external co-signer or webhook hook** (which matters for Intent Firewall), approvals are signed on a dashboard, and velocity caps can be exceeded under concurrent requests.

### Cited Findings
- **Agent custody [DOCS]:**
  - `POST /register` returns an API key, a NEAR account ID and a handoff URL, with no chain transaction.
  - Base URL is `https://api.outlayer.fastnear.com`, and there is a testnet variant.
  - Deterministic wallets derive from `(account_id, seed, vault)`.
  - Endpoints: `POST /wallet/v1/call` (arbitrary NEAR contract calls: receiver_id, method_name, args, deposit), FT transfers and storage-deposit, NEP-413 message signing, EIP-712/EIP-191 and Ed25519 signing, plus Intents deposit, withdraw (with optional `async`), swap and transfer, and `/wallet/v1/confidential/*` (mainnet only).
  - A revert returns HTTP 422 `onchain_tx_failed`; do not retry it.
  - [OutLayer agent custody](https://outlayer.fastnear.com/docs/agent-custody)
- **Policies [DOCS]:**
  - Policies are stored encrypted on-chain, and only the TEE decrypts them.
  - Available controls: per-transaction limits per token, hourly/daily/monthly caps, allow and deny lists, time windows and rate limits.
  - Capabilities are default-deny: `raw_sign`, `swap`, `cross_chain_withdraw`, `confidential`, `payment_check`, `evm_sign`, `solana_sign`.
  - The wallet can be frozen with one click.
  - "**No external co-signer or webhook mechanisms documented**."
  - Caveat: cumulative caps "may be exceeded under concurrent requests" because the gateway supplies the counters.
  - [OutLayer agent custody](https://outlayer.fastnear.com/docs/agent-custody)
- **Multisig [DOCS]:** an agent submit returns `{"status":"pending_approval","required":2,"approved":0}`. Approvers sign NEP-413 messages "via NEAR wallet… on dashboard", and once the threshold is met the transaction executes automatically. Roles are Admin and Signer. For Intents swaps and confidential transfers, "the TEE verifies approver signatures and pins the recipient but does not re-verify token/amount against the 1Click artifact", so it relies on gateway honesty for the value terms — [OutLayer agent custody](https://outlayer.fastnear.com/docs/agent-custody)
- **Keys [DOCS]:** keys are derived as `HMAC-SHA256(mpc_master_secret, "wallet:{id}:{chain}")` inside TDX, with the master secret coming from the NEAR MPC network — [OutLayer agent custody](https://outlayer.fastnear.com/docs/agent-custody)
- **Tooling and maturity [DOCS]:** there is a skill file at `skills.outlayer.ai/agent-custody/SKILL.md` and an OutLayer CLI. Pricing is per transaction. Custody is live on mainnet. Testnet has no Intents solvers (503). The docs do not state beta or GA — [OutLayer agent custody](https://outlayer.fastnear.com/docs/agent-custody)
- **Contract-callable compute (yield/resume style) [DOCS]:**
  - A NEAR contract calls `request_execution` on `outlayer.near` (mainnet) or `outlayer.testnet` and gets results in a callback such as `on_outlayer_result` via `env::promise_result(0)`.
  - The code source can be a GitHub repo compiled on demand (about 10 s to minutes), a precompiled WasmUrl (about 1 s), or a registered Project.
  - Defaults are 1B instructions, 128 MB and 60 s, with a 180 s maximum.
  - Encrypted secrets are injected as environment variables.
  - Cost is base fee + instructions + time, paid in attached NEAR, and unused funds are refunded. `estimate_execution_cost()` gives an estimate.
  - Every execution carries a TDX attestation of the WASM SHA256 and its inputs and outputs, viewable at `/executions`.
  - [OutLayer NEAR integration](https://outlayer.fastnear.com/docs/near-integration); also listed under NEAR docs "off-chain compute" — [docs.near.org OutLayer](https://docs.near.org/primitives/off-chain-compute/outlayer)

### Inferences
- **For Intent Firewall:** there is no webhook. To make an LLM a co-signer, register a backend key as one of the "Signer" approvers and have the backend sign NEP-413 approvals after an LLM check. This only works if approvals can be submitted by API rather than through the dashboard UI. The other route is to skip OutLayer custody and build your own contract wallet (see the per-idea section).
- **Setup time:** custody wallet plus policies in about half a day (REST). Contract → `request_execution` → callback in about 1 day, on testnet for non-Intents logic.
- **Calling an LLM from inside OutLayer WASM** (for example to NEAR AI Cloud) needs network access from WASI. I did not confirm that it is allowed.

### Gaps
- Is there an API for submitting approvals, or is it dashboard-only? Does OutLayer WASM have outbound HTTP? What is the per-transaction price? Who audited it?
- I did not find GitHub repo stars or activity, so maturity signals are thin beyond the docs.

---

## 5. Shade Agents and Chain Signatures

### Takeaway
**Shade Agents are deprecated as standalone tooling.** Per docs.near.org, the framework has not been maintained since April 19, 2026, so avoid it for the hackathon. Chain Signatures (the MPC `v1.signer` contract) remain live and documented, with the `chainsig.js` library. For a TEE agent, use OutLayer or NEAR AI Cloud instead of shade-agent-js on Phala.

### Cited Findings
- "After April 19th, 2026, the Shade Agent Framework will no longer [be] maintained as standalone developer tooling". The docs moved to `github.com/NearDeFi/shade-agent-framework/tree/main/docs`. Teams "assume responsibility for maintenance, updates, and any necessary fixes" — [docs.near.org Shade Agents deploying](https://docs.near.org/ai/shade-agents/quickstart/deploying)
- Historical CLI: `npm i -g @neardefi/shade-agent-cli` builds and deploys the agent contract, publishes a Docker image, and deploys to Phala Cloud, configured by `deployment.yaml`. **This is older info and the tooling is now unmaintained** — [Shade Agent CLI reference](https://docs.near.org/ai/shade-agents/reference/cli)
- Chain Signatures: mainnet `v1.signer`, testnet `v1.signer-prod.testnet`. The MPC network has 8 nodes. Supports Secp256k1 and Ed25519 signing for BTC, Solana, Cosmos, XRP, Aptos, Sui and EVMs. Library: `chainsig.js` — [docs.near.org Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures); [MPC operators overview](https://mpc-operators.nearone.org/overview.html)

### Inferences
- Setup time for Chain Signatures: about 1 day to derive an address and sign and broadcast an EVM transaction from a NEAR contract or account with chainsig.js on testnet. Shade Agents would cost 1–3 days on Docker, Phala and attestation plumbing, with breakage risk because the tooling is unmaintained.
- For cross-chain *value movement*, 1Click is simpler than Chain Signatures. Use Chain Signatures only when you need control of the remote chain's *account*, such as calling a contract on Base.

### Gaps
- Is there a successor to Shade Agents (e.g. folded into OutLayer or NEAR AI)? I did not confirm.

---

## 6. Other pieces: Rhea lending, Trezu/Sputnik, token standards, access keys, meta-tx, SDKs

### Takeaway
Rhea (formerly Burrow) lending was exploited for $18.4M on April 16, 2026. Margin trading was permanently discontinued, and lending was scheduled for a phased reopening from early May 2026. **I could not confirm that lending is live today**, which is a hard dependency for Never-Liq. Trezu is a live Sputnik-based treasury app. near-sdk-rs is the actively developed SDK, while near-sdk-js is stable but quiet.

### Cited Findings
- **Rhea exploit [press]:** April 16, 2026, $18.4M, using a slippage-protection flaw in multi-step swaps that triggered forced liquidations and drained the reserve. Margin trading was "permanently discontinued". Lending targeted "phased reopening starting from the first week of May 2026", contingent on audits and monitoring bots. About $3.5M was returned and 4.34M USDT frozen — [The Block](https://www.theblock.co/post/397961/rhea-finance-post-mortem-exploit-losses-18-4-million-double-initial-estimates); [TechFlow](https://www.techflowpost.com/en-US/newsletter/120176); [AMBCrypto](https://ambcrypto.com/rhea-finance-revises-exploit-losses-to-18-4m-confirms-slippage-flaw-as-funds-partially-recovered/)
- **Rhea background [press]:** formed by the Ref + Burrow merger in 2025. Lending contract historically `contract.main.burrow.near` [BACKGROUND] — [iq.wiki Burrow](https://iq.wiki/wiki/burrow-finance)
- **Trezu [press/GitHub]:** a treasury platform for NEAR DAOs with members, payments, vesting and Sputnik DAO proposal and multisig flows. It reports about $150M AUM and 433 treasuries — [GitHub olskik/trezu](https://github.com/olskik/trezu); [sputnikdao npm tools](https://npmjs.com/package/sputnikdao)
- **SDKs [DOCS/third-party]:** near-sdk-rs is in active development, preparing 6.x. cargo-near is in maintenance mode. near-workspaces-rs is being deprecated in favor of near-api-rs and near-sandbox-rs — [NEAR Rust DevTools status (Jan 2026)](https://docs.near.org/blog/2026-01-06-near-rust-devtools-2025). near-sdk-js v2.0.0 had low recent activity — [Snyk advisor](https://snyk.io/advisor/npm-package/near-sdk-js)

### Inferences
- [BACKGROUND, not re-verified]:
  - NEP-141 (FT, `ft_transfer_call` with `ft_on_transfer` and `ft_resolve_transfer`), NEP-171 (NFT) and NEP-245 (multi-token, used by `intents.near` balances) are stable standards.
  - Function-call access keys (allowance-limited and method-scoped) let a dapp sign without wallet popups.
  - NEP-366 meta-transactions (DelegateAction plus a relayer) enable gasless UX.
  - All of these are mature and low-risk for a hackathon.
- **SDK choice:** use **near-sdk-rs** for escrow or verification contracts. It has `ecrecover`, `ed25519_verify` and `sha256` host functions [BACKGROUND], and near-sdk-js maintenance looks thin. near-sdk-js is fine for simple escrow if you are TypeScript-only.
- **Rhea data:** monitoring health factors needs Rhea view methods such as `get_account` and `get_asset`, plus a price oracle [BACKGROUND]. The April exploit means the contract interface may have changed in the upgrade.

### Gaps
- Is Rhea lending live as of Oct 2026, and are the contract and method names unchanged? DefiLlama returned 403.
- Does Rhea expose a liquidation API or bot reference?

---

## 7. The Sept 29–Oct 1, 2026 NEAR Intents exploit: details and API changes

### Takeaway
Confirmed. An attacker used the `intents.near` **deposit-notification feature** (the `Notify` deposit action that calls a third-party receiver contract). Twenty-three deliberately failing notifications between Sep 29 and Oct 1 created about $3.8M of unbacked "ghost" balances, which were withdrawn as USDT on BNB Chain through Omni. Funds were returned within about 36–48 hours (around Oct 2). A temporary fix shipped Oct 2, and after a further critical report **the Notify feature was removed entirely on Oct 7** (PR #374). Apps must now handle deposit notification off-chain. **This directly limits hackathon designs** that relied on `intents.near` notifying a contract on deposit.

### Cited Findings
- **Mechanism:**
  1. `ft_transfer_call` sends tokens to `intents.near` (`ft_on_transfer`).
  2. The verifier credits the internal ledger and then calls the attacker-specified receiver.
  3. The receiver panics, NEP-141 refunds the tokens, and `ft_resolve_deposit` fails to reverse the credit.
  - Result: "the ledger says Y + $3.8M, the contract actually holds Y". PR #374 commented out the `Notify` variant of `DepositAction`.
  - [The Coding substack postmortem explainer](https://thecoding.substack.com/p/near-intents-ghost-fund-postmortem)
- **Timeline:** exploitation ran Sep 29–Oct 1 over 23 failed deposit transactions. The protocol shut down on Oct 1. Funds came back within 36 hours, and a temporary fix shipped Oct 2. **The feature was completely removed on Oct 7.** A $300K bounty went to the second reporter. Automatic pause on balance inconsistencies was added, because earlier monitoring had only compared origin-chain assets with NEAR token balances — [ChainCatcher postmortem summary](https://www.chaincatcher.com/en/article/2296917)
- **Who wrote it, and what changes for integrators:** the postmortem by Alex Shevchenko was published Oct 16. "Apps that need deposit notifications now get them outside the contract that holds the funds" — [Defiprime](https://defiprime.com/near-intents-recovers-3-8m-after-contract-exploit); [The Defiant](https://thedefiant.io/news/security/near-intents-postmortem-links-3-8-million-exploit-to-deposit-bug)
- **Pauses and impact:** a contract patch shipped within about 1 hour. Eleven networks (BSC, Polygon, TON, Optimism, Avalanche, Stellar, Monad, X Layer, ADI, Scroll, Plasma) were paused for about 12 hours. The initial blame on Omni was corrected. Integrators (Ledger, Brave, Infinex, ThorSwap, HOT) lost nothing — [Shattered.io](https://shattered.io/near-intents-3-8m-hack-postmortem-clears-omni-2026/)
- **Minor conflict:** one source says funds returned "within ~48 hours after ultimatum" — [Shattered.io](https://shattered.io/near-intents-hack-3-8-million-returned-2026/). Another says 36 hours — [ChainCatcher](https://www.chaincatcher.com/en/article/2296917). A KuCoin headline says "$380,000", which looks like a typo for $3.8M — [KuCoin](https://www.kucoin.com/news/flash/near-intents-reveals-380k-usd-funds-fully-recovered-after-october-1-vulnerability-incident)
- **Docs:** the public changelog showed **no October entry** when I read it. API-level changes after the incident are not documented there — [Changelog](https://docs.near-intents.org/changelog/overview.md)

### Inferences
- For hackathon contracts: you **cannot** use `intents.near` deposits to trigger your contract's logic atomically. Use one of these instead:
  - (a) Have 1Click deliver funds to an account you control and run an off-chain relayer that watches `/v0/status` and calls your contract.
  - (b) Have the user call `ft_transfer_call` into your contract directly on NEAR.
  - (c) Withdraw from intents to your contract, using `ft_transfer_call` if `intents.near`'s withdraw supports `msg`. That is unconfirmed after the change.
- Judges may treat "secure deposit accounting" as a talking point. Follow the postmortem checklist: credit only after finalization, treat receivers as hostile, and keep a solvency invariant.

### Gaps
- Does `intents.near` `ft_withdraw` / `mt_withdraw` with `msg` (which triggers the receiver's `ft_on_transfer`) still work after Oct 7? Did any 1Click quote fields change (e.g. `customRecipientMsg`)? Not found.

---

## 8. Per-idea feasibility verdicts (solo, 14 days)

### Takeaway
The easiest strong builds use **public NEAR contracts + 1Click for cross-chain in/out + NEAR AI Cloud signed verdicts**. That covers Bidwire, Stake-to-Show, Factmarket, the Intent Firewall variant, and Sealed-lite. Ideas whose core value depends on **contract-held confidential balances or third-party view keys** (true Sealed, Copy-Key) are not buildable as specified with documented APIs. Never-Liq depends on whether Rhea lending is live.

### Cited Findings (key constraints driving verdicts)
- Confidential mode covers swaps only today, with deposits and DeFi "rolling out" — [Aurora Intents docs](https://docs.intents.aurora.dev/confidential-intents). FAR runs only `intents.far` — [MM docs](https://docs.near-intents.org/integration/market-makers/confidential-intents.md)
- Confidential quotes require user auth [VERIFIED-LIVE] — [1Click](https://1click.chaindefuser.com/v0/quote)
- Confidential limit orders exist (Aug 28), and confidential solvers are allowlisted (Jul 13) — [Changelog](https://docs.near-intents.org/changelog/overview.md)
- The deposit Notify feature was removed Oct 7 — [ChainCatcher](https://www.chaincatcher.com/en/article/2296917)
- NEAR AI signatures are EIP-191 ECDSA / Ed25519 over sha256 hashes — [NEAR AI docs](https://docs.near.ai/cloud/verification/reference/response-signature-verification.md)
- OutLayer has policies and multisig but no webhook co-signer — [OutLayer](https://outlayer.fastnear.com/docs/agent-custody)
- Shade Agents are deprecated — [docs.near.org](https://docs.near.org/ai/shade-agents/quickstart/deploying)
- Rhea lending's reopen status is unconfirmed — [The Block](https://www.theblock.co/post/397961/rhea-finance-post-mortem-exploit-losses-18-4-million-double-initial-estimates)

### Inferences (verdicts; these are my judgments)
| Idea | Verdict | Why / buildable scope |
|---|---|---|
| **Sealed** (confidential AI-resolved cross-chain prediction market) | **AMBER: build "Sealed-lite"** | Positions cannot be confidential inside a contract. What is feasible: a public NEAR escrow contract (near-sdk-rs); cross-chain funding via 1Click, optionally confidential on the user's side so the origin wallet is unlinkable; an AI resolver on NEAR AI Cloud (open-weight model) whose signed verdict is checked in-contract with `ecrecover` against an allowlisted TEE signer; and payouts optionally routed confidentially by a backend. Bet sizes on NEAR stay public. A commit-reveal scheme can hide sides until close. 10–12 dev-days, tight but doable. |
| **Whisper OTC** (open deal board + private fills) | **AMBER-GREEN** | The deal board is a public NEAR contract or a web2 app. "Private fill" means each taker executes via a 1Click confidential swap or confidential limit order (Aug 28) that ends in `CONFIDENTIAL_INTENTS` or on another chain. The catch: fills go through allowlisted solvers, so a **direct P2P maker↔taker fill at a fixed OTC price is not guaranteed**. The board becomes price discovery plus a confidential execution link. User-auth signing is required. 7–9 days. |
| **Copy-Key** (sell viewing keys to private trades) | **RED as specified** | No documented view-key API exists for third-party apps. View keys are "user-initiated" and account-level (marketing only). Sharing a user-session token would likely grant execution rights too, which is unsafe. Pivot: traders publish trade receipts signed by the app (or NEAR AI attested) after the fact, then token-gate or sell them. That loses the trust-minimized property. Ask NEAR Discord first. |
| **Never-Liq** (cross-chain liquidation guardian on Rhea) | **AMBER (dependency risk)** | Mechanics are feasible: monitor Rhea health factors via view calls; when near the threshold, pull collateral from another chain via 1Click into an OutLayer custody wallet or a user-delegated account, then `ft_transfer_call` into Rhea to add collateral or repay. Policies (caps, allowlist = Rhea contract) come from OutLayer. Blockers: Rhea lending live status after the April exploit is unconfirmed, the contract interface may have changed, and 1Click delivery cannot notify Rhea directly (Notify removed), so a relayer or agent hop is needed. 9–11 days if Rhea is live. |
| **Intent Firewall** (TEE LLM semantic co-signer for agent wallets) | **GREEN (own contract wallet) / AMBER (on OutLayer)** | Best path: a NEAR smart-wallet contract that executes an action only with (a) the agent's signature and (b) a NEAR AI Cloud signed "ALLOW" verdict over the exact request and response bytes. The contract verifies with `sha256` + `ecrecover` against an allowlisted TEE signing address. A function-call access key limits the agent. OutLayer has no webhook co-signer, and approvals look dashboard-driven, so integrating there depends on an approval API. 8–10 days. Strong fit with NEAR's AI narrative. |
| **Bidwire** (sealed-bid agent job market + escrow + AI arbiter) | **GREEN** | Sealed bids via commit-reveal on-chain, or bids encrypted to a backend (NEAR AI E2EE or OutLayer secrets are optional extras). NEP-141 escrow in near-sdk-rs. The AI arbiter verdict is signed by NEAR AI and verified on-chain or off-chain. Cross-chain payouts via 1Click. Every piece is documented and stable. 7–9 days. |
| **Stake-to-Show** (cross-chain Kickback deposits) | **GREEN (simplest)** | NEAR contract with a USDC (NEP-141) stake per event, check-in (signed QR / NEP-413), and redistribution of no-show stakes. Cross-chain entry: 1Click quote from any of 37 chains → USDC on NEAR. Because Notify is gone, attribute deposits through a relayer (watching `/v0/status` → `register(attendee)`) or deliver to the user's NEAR account and then `ft_transfer_call`. Users who pay from a CEX hit a minimum of about $0.15 per route, so that is not an issue. 5–7 days, leaving time for polish. |
| **Factmarket** (wiki of prediction markets) | **GREEN (mostly web2)** | Wiki front end plus simple NEAR binary-market contracts, or even just links. NEAR AI handles summarization and resolution suggestions with signed outputs. The low primitive risk means the challenge is content and UX rather than tech. It may impress judges less on "NEAR primitives". 6–8 days. |
| **Pocket Pet** (AI pet NFT paying its own inference) | **AMBER** | NEP-171 NFT plus a per-pet wallet (OutLayer deterministic wallet or NEAR account) holding funds. The "pays own inference" part has no documented on-chain or crypto payment path for NEAR AI Cloud (API keys and dashboard billing only). Options: a backend meters usage and debits the pet's on-chain balance (honest but custodial), or the pet pays OutLayer execution in NEAR on-chain, which is documented, while the LLM call happens via a backend. Inference at about $0.04–0.30 per M input tokens on open models makes the economics trivial. 7–9 days. |

### Gaps
- None of these verdicts was validated against a working prototype. Day-1 spikes should confirm three things: (1) a confidential quote with user auth, (2) on-chain `ecrecover` of a real NEAR AI signature, and (3) Rhea lending status.

### Precise questions to ask in NEAR Discord (NEAR Intents / NEAR AI / OutLayer channels)
1. Confidential: what exactly is the difference between `confidentiality: "basic"` and `"advanced"`? Which one makes deposits and withdrawals unlinkable?
2. Can a **NEAR smart contract account** hold a `CONFIDENTIAL_INTENTS` balance, be a confidential recipient, or authenticate (it cannot sign NEP-413)? Will arbitrary contracts ever be deployable on FAR?
3. Is there a **confidential P2P transfer** between two `CONFIDENTIAL_INTENTS` balances via 1Click (not a swap)? What about a directed OTC fill between two specific users at a fixed price?
4. **View keys:** is there an API to create, share or verify the "account-level view key", and is it time-scoped? Can a third-party app consume it read-only? Is a user-session token read-only or execution-capable?
5. When will confidential deposits and confidential DeFi actions (marked "rolling out") ship? What are the confidential-mode minimums and fees?
6. After the Oct 7 removal of deposit `Notify`: does `ft_withdraw`/`mt_withdraw` with `msg` to a NEAR contract still call `ft_on_transfer`? Can 1Click deliver to a NEAR contract with a custom msg?
7. Is the Sep 9 temporary $1,000 origin→origin minimum still active, and on which chains? Is there any testnet or sandbox for 1Click? What does the `insured` quote field mean?
8. Partner JWT: how long does approval at partners.near-intents.org take? Are there hackathon fee waivers?
9. NEAR AI Cloud: do proprietary models (Claude, GPT, Gemini) return TEE-signed responses, or only NEAR-hosted open models? How long are `/v1/signature/{chat_id}` results retained? How often do signing addresses rotate? Are there hackathon credits? Can usage be paid in crypto or on-chain?
10. OutLayer: is there an API (not the dashboard) for submitting multisig approvals, so a bot can be a Signer? Is there an external co-signer or webhook policy hook? Can WASM in `request_execution` make outbound HTTPS calls (e.g. to NEAR AI Cloud)? What is the per-transaction pricing?
11. Rhea: is lending live on mainnet now? Are the contract ID and methods (`contract.main.burrow.near`, `get_account`, `execute`) unchanged after the post-exploit upgrade? Is there a reference liquidation or health-factor bot?
12. Is there a successor to the deprecated Shade Agent Framework that hackathon judges expect people to use?
