# Mainnet runbook, 11 November

Every step to put one Intented wallet on NEAR mainnet and pay through it: the real $2 payment to Base through 1Click (KT4), and one attack the wallet refuses on chain, with transaction hashes. Why only one wallet: [the record](./decisions/2026-11-06-one-mainnet-wallet.md). The product stays on testnet.

Owner of the runbook: Furqaan. **Nothing here runs before both Furqaan and William say yes on the day. A person, not an agent, runs every step that moves money.** Budget: $20–50 in all.

Written 6 November. The preflight first ran on 6 November (results below) and runs again on 9 November. The transaction hashes are filled in on the day.

## 0. To settle before 11 November

| Item | Proposed | Who |
| --- | --- | --- |
| Accounts | `intented-wallet.near`, a top-level account William creates (William doesn't have `intented.near`'s key; [record](./decisions/2026-11-09-mainnet-wallet-intented-wallet-near.md)). Separate accounts `intented-owner.near`, `intented-agent.near`, `intented-vendor.near` (all free on 6 November) | Both |
| Who holds which key | `intented.near`, the owner and the vendor: the password manager. The agent's function-call key: the machine the demo agent runs on. The wallet's full-access key: deleted at step 9 | Both |
| Token and caps | USDC on NEAR (`17208628…33a1`, 6 decimals). 5 USDC per payment, so the attack fits under the cap and is refused by the verdict, not the cap. 10 USDC per day. NEAR caps: 1 yocto per action, 100 a day | Both |
| The mandate | Agreed by William on 9 November: `Buy market data from intented-vendor.near, paid in USDC, at most 0.10 USDC per call, or from 0x2ef2fed3f9b3d5385499008051031320b1fb49ef on Base, paid in USDC, at most 5 USDC per call.` The Base address is William's, lowercase as the wallet requires | Both |
| The cross-chain recipient list | The vendor's Base address only. The attack's receipt then shows the model's signed `DENY`, and the wallet's on-chain refusal by the list, as on testnet (`DbLMFYWs…`) | Both |
| The payments | The honest one: 2 USDC to the vendor on Base. The attack: 4 USDC to `0xbad0…0bad` on Base, under the cap | William (the paywall), both |
| The mainnet API | `NEAR_NETWORK=mainnet`, `CONTRACT_ACCOUNT_ID=intented-wallet.near`, `ONECLICK_JWT`, no stand-in, a daily verdict cap | William |
| The mainnet site | The "Testnet \| Mainnet" switch; only this wallet; Create hidden; mainnet nearblocks links | William |
| The demo agent on mainnet | `AGENT_ACCOUNT_ID=intented-agent.near` and its key, `NEAR_NETWORK=mainnet`, the mainnet API | William |

## 1. Preflight (9 November, read-only)

Nothing here writes to mainnet.

| Check | Command | Pass |
| --- | --- | --- |
| Every test passes | `cargo test` in `contract/wallet` and `contract/factory`; `pnpm test` in `firewall-core`, `api`, `agent`, `redteam`, `mcp` | 0 failures |
| The signer hasn't rotated | `cd firewall-core && pnpm attest` (no `--register`) | Every check passes; the signer is `0x835ab53d…aa26`, or a new one is noted. 6 Nov: verified, TDX up to date, report_data binds signer and nonce, NVIDIA GPU attestation true, same signer |
| The mainnet prompt hash | `sha256(systemPrompt("mainnet"))`, the one-liner in `deploy-wallet.sh` | 6 Nov: `1fe49a467647885272f88f5983fab39cc43f6469225ec96033bd50e8be30706f` (testnet's is `2c738124…7f1ec6`, as on `intented-wallet.testnet`). It changes if the prompt or the mainnet token table changes |
| 1Click's real key signs real quotes | A mainnet quote from 1Click, checked with `verifyQuote` in `firewall-core/scripts/oneclick-quote.ts` against `ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc` | 6 Nov: 2 USDC on NEAR to 2 USDC on Base, exact output, `amountIn` 2022925; the dry and the live quote both verify, and the live one's signed payload includes its `depositAddress` |
| The build is the tested code | `cd contract/wallet && cargo near build non-reproducible-wasm && shasum -a 256 target/near/intented_wallet.wasm` | Hash written here: `<to fill>` |
| Secrets | `git log -p` searched for private keys (`ed25519:` and 80+ base58 characters) and the JWT's prefix | None in history |

## 2. Accounts and NEAR (both say yes first)

1. Create `intented-wallet.near` with about **3.6 NEAR**: about 3.3 NEAR to store the code (327 KB), plus state.
2. Create `intented-owner.near` with about 0.3 NEAR for gas and token storage, `intented-agent.near` with about 0.3 NEAR for gas, and `intented-vendor.near` with about 0.1.
3. Keys go to the keychain and the password manager. Nothing goes in the repo.
4. The wallet's full-access key is **kept** (step 9 is skipped), so after judging the owner withdraws the USDC and the account is deleted, returning its storage NEAR. Always withdraw tokens before deleting an account: deleting one that holds tokens loses them.

## 3. Deploy and configure

```sh
WALLET_ID=intented-wallet.near OWNER_ID=intented-owner.near AGENT_ID=intented-agent.near \
MODEL=Qwen/Qwen3.8-27B NETWORK=mainnet CONFIRM_MAINNET=yes \
TOKEN_ID=17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1 \
TOKEN_PER_TX=5000000 TOKEN_DAILY=10000000 \
MANDATE_TEXT="<the mainnet mandate from section 0>" \
contract/wallet/scripts/deploy-wallet.sh
```

It builds, deploys with `new`, sets the mainnet prompt hash, the USDC token and caps, the receiver allowlist, the NEAR caps and the mandate. It then verifies the model's attestation off chain and registers its signer (`pnpm attest --register`).

Check:
- `get_config` shows the model, the prompt hash from step 1, the mandate hash, the signer and the NEAR caps.
- `get_token` shows USDC and its caps.
- The account's `code_hash` is base58 of the wasm hash from step 1.

## 4. Cross-chain settings (owner)

```sh
W=intented-wallet.near; O=intented-owner.near
call() { near contract call-function as-transaction $W "$1" json-args "$2" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as $O network-config mainnet sign-with-keychain send; }
call set_one_click_key '{"public_key":"ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc"}'
call set_cross_chain '{"enabled":true}'
call allow_cross_chain_recipient '{"address":"<the vendor Base address, lowercase>"}'
```

Check: `get_config` shows 1Click's real key, cross-chain on, and the one recipient.

## 5. The agent's key

On the machine the demo agent runs on, make a key pair. Add only its public key to `intented-agent.near` as a function-call key for `propose` and `execute` on `intented-wallet.near`; `deploy-wallet.sh` prints the command at the end. The private key never leaves that machine.

## 6. Token storage and funding

1. Register `intented-wallet.near` and `intented-vendor.near` on USDC: `storage_deposit` with `{"account_id": "<id>", "registration_only": true}` and 0.00125 NEAR attached, signed by the owner.
2. The owner sends the wallet **3 USDC**: about 2.03 for the payment, the rest for one retry. The refused attack moves nothing.
3. Check: `ft_balance_of` for the wallet returns `3000000`.

## 7. The mainnet API and site

1. William starts the mainnet API and site with the settings from section 0.
2. Store the mandate text with `POST /api/mandate`, then check that `GET /api/mandates/<hash>` hashes to the wallet's `mandate_hash`.
3. Check that the switch shows the mainnet wallet's rules, and that its links go to mainnet nearblocks.

## 8. The payments

`pnpm agent base` and `pnpm agent base-poisoned`, against the mainnet wallet and API.

| # | Payment | Expected | Hash |
| --- | --- | --- | --- |
| 1 | Honest through 1Click (KT4): 2 USDC to the vendor's Base address | `ALLOW`; about 2.02 USDC to 1Click's deposit address; 1Click reports `SUCCESS` with a Base transaction; the vendor's Base USDC rises by 2 | `<to fill>`, Base `<to fill>` |
| 2 | The attack: 4 USDC to `0xbad0…0bad` on Base, under the cap | `DENY`; `execute` refused on chain; no transfer | `<to fill>` |

**Fallback, only if 1Click doesn't deliver:** `pnpm agent honest` (0.10 USDC to `intented-vendor.near`) and `pnpm agent poisoned`. Same checks. The README then says plainly that the 1Click delivery failed.

After each payment, check its receipt on the mainnet site: the reason, the signer, the signature and the transaction.

## 9. Delete the wallet's full-access key

**Skipped for `intented-wallet.near`**: the key is kept so its storage NEAR can be recovered after judging ([record](./decisions/2026-11-09-mainnet-wallet-intented-wallet-near.md)). For a wallet meant to stay, only after steps 3–8 are checked, and both say yes:

```sh
near account list-keys intented-wallet.near network-config mainnet now
near account delete-keys intented-wallet.near public-keys '<the full-access public key>' network-config mainnet sign-with-keychain send
near account list-keys intented-wallet.near network-config mainnet now   # no full-access key left
```

After this nobody can replace the wallet's contract. The owner keeps every owner method, `freeze` and `withdraw`. A bug means withdraw and deploy a new wallet.

## 10. Record it

1. Write a decision record, `docs/decisions/2026-11-11-mainnet.md`: the accounts, the wasm hash, the signer, every transaction hash, and what was spent.
2. Update the README's Status with the mainnet transactions. Change "Not done: the first real payment on mainnet, through 1Click itself" to what actually happened. It says one wallet is on mainnet, not that the product is.
3. If the signer changed, publish the attestation report in `docs/attestations/`.

## If something fails

| At | Do |
| --- | --- |
| Deploy or configure (3–4) | The full-access key still exists: fix and redeploy, or `freeze` while deciding |
| Funding (6) | `withdraw` returns tokens to the owner, and it works while frozen |
| A payment does the wrong thing (8) | `freeze` at once, then `withdraw`. Stop and write it up before anything else. Never try to fix it live |
| 1Click doesn't deliver (8.1) | Keep the deposit hash and 1Click's status, and ask in 1Click's channel. The refund goes to the wallet, the quote's `refundTo`. Run the fallback |
| After step 9 | No redeploy is possible: withdraw, and deploy a new wallet if needed |
