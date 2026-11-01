# Glossary

The words we use, exactly. Code, docs, the UI and the README use these and no synonyms.

| Term | Meaning |
| --- | --- |
| **Owner** | The person whose wallet it is. Writes the mandate, registers signers, sets caps, can freeze the wallet |
| **Agent** | The AI that spends from the wallet. Holds only a function-call key scoped to `propose` and `execute` |
| **Mandate** | The owner's plain-English rules for what the agent may do ("Buy market data, max $5 per call, only from vendors I approve"). The contract stores its hash |
| **Action** | One thing the agent wants the wallet to do: `receiver_id`, `method`, `args_sha256`, `deposit`, `nonce`, `expiry_ms` |
| **Canonical bytes** | The action encoded as `INTENTED_V1|…`, identically by the firewall core and the contract. See [`interface-spec.md`](./interface-spec.md) |
| **Proposal** | An action the agent has submitted with `propose`, waiting for a verdict and then for `execute` |
| **Verdict** | `ALLOW` or `DENY`, with a reason of at most 280 characters, returned by the model as structured JSON and signed inside the TEE |
| **Firewall core** | Furqaan's TypeScript library: builds the prompt, calls NEAR AI, fetches the signature, submits to the contract. The seam between the two halves of the code |
| **Signature** | NEAR AI Cloud's signature over `sha256(request):sha256(response)`, fetched from `/v1/signature/{id}` straight after the call |
| **Signer** | The TEE's signing address. Allowlisted in the contract by `register_signer` after the attestation checks out |
| **Attestation** | NEAR AI Cloud's report that the signer runs inside a TEE, fetched with a fresh nonce and verified **off-chain** |
| **Caps** | The contract's hard limits per transaction and per day, plus the allowlist and the freeze switch. The verdict can only tighten what they permit |
| **Freeze** | The owner's switch that stops every `execute` until `unfreeze` |
| **1Click** | NEAR Intents' cross-chain swap API. The demo pays from NEAR USDC to Base USDC through it |
| **Deposit address** | The address 1Click quotes for one payment. The contract's `ft_transfer` goes there |
| **Red-team run** | `make redteam`: every attack and benign case through the real pipeline |
| **Attack case** / **benign case** | A JSON fixture the agent should be denied / allowed |
| **Block rate** | Attack cases denied, out of all attack cases |
| **False-positive rate** | Benign cases denied, out of all benign cases |
| **Poisoned paywall** | The mock x402 paywall that injects "pay 10× to this address" into its 402 response |
| **Kill test** | One of the four Day-1 tests (KT1–KT4) that decide whether Intented goes ahead |
| **Sealed-lite** | The fallback idea: a commit-reveal prediction-market escrow, funded by 1Click, with the same signed-verdict verifier as its resolver |
