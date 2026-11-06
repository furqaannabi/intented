# Mainnet runbook, 11 November

Every step to put the full protocol on NEAR mainnet: the factory at `intented.near`, the demo wallet `demo.intented.near` made by it, and the mainnet API, site and agent. Then one allowed and one refused payment, with transaction hashes, and the real $2 payment through 1Click (KT4). Why the full protocol: [the record](./decisions/2026-11-06-full-protocol-on-mainnet.md).

Owner of the runbook: Furqaan. **Nothing here runs before both Furqaan and William say yes, and a person, not an agent, runs every step that moves money.** Budget: $20–50 in all.

Written 6 November; rewritten the same day for the factory. The preflight first ran on 6 November (results below) and runs again on 9 November. The transaction hashes are filled in on the day.

## 0. Before 11 November

| Item | State | Who |
| --- | --- | --- |
| Cap ceilings in the wallet and the factory, tested, with spec rows agreed | Proposed; to build by 9 Nov | Furqaan, William's yes on the rows |
| The ceilings' numbers (USDC and USDt 5 a payment, 20 a day; wNEAR from the day's price; NEAR 1 yocto and 100 yocto) | Proposed | Both |
| Who holds `intented.near`'s key, and who holds `intented-owner.near`'s and `intented-vendor.near`'s | To settle; keys in the password manager | Both |
| The mainnet mandate for the demo wallet: the vendor account, the vendor's Base address, USDC, the per-payment limit | To write, in the testnet mandate's shape | Both |
| `intented init` and `intented pay` on mainnet (today they are testnet only) | To build | William |
| The mainnet API: `NEAR_NETWORK=mainnet`, `FACTORY_ACCOUNT_ID=intented.near`, `CONTRACT_ACCOUNT_ID=demo.intented.near`, `ONECLICK_JWT`, no stand-in, a daily verdict limit | To build and host | William |
| The mainnet site: the "unaudited, small amounts" notice on Create, with the ~3.8 NEAR storage cost per wallet | To build | William |

## 1. Preflight (9 November, read-only)

Nothing here writes to mainnet.

| Check | Command | Pass |
| --- | --- | --- |
| Every test passes | `cargo test` in `contract/wallet` and `contract/factory`; `pnpm test` in `firewall-core`, `api`, `agent`, `redteam` | 0 failures |
| The signer hasn't rotated | `cd firewall-core && pnpm attest` (no `--register`) | Every check passes; the signer is `0x835ab53d…aa26`, or a new one is noted. 6 Nov: verified, TDX up to date, report_data binds signer and nonce, NVIDIA GPU attestation true, same signer |
| The mainnet prompt hash | `sha256(systemPrompt("mainnet"))`, the one-liner in `deploy-wallet.sh` | 6 Nov: `1fe49a467647885272f88f5983fab39cc43f6469225ec96033bd50e8be30706f` (testnet's is `2c738124…7f1ec6`, as on `intented-wallet.testnet`). It changes if the prompt or the mainnet token table changes |
| 1Click's real key signs real quotes | A mainnet quote from 1Click, checked with `verifyQuote` in `firewall-core/scripts/oneclick-quote.ts` against `ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc` | 6 Nov: 2 USDC on NEAR to 2 USDC on Base, exact output, `amountIn` 2022925; the dry and the live quote both verify, and the live one's signed payload includes its `depositAddress` |
| The builds are the tested code | `cargo near build non-reproducible-wasm` in `contract/wallet` and `contract/factory`; `shasum -a 256` of each wasm | Hashes written here: wallet `<to fill>`, factory `<to fill>` |
| Secrets | `git log -p` searched for private keys (`ed25519:` followed by 80+ base58 characters) and the JWT's prefix | None in history |

## 2. Accounts (both say yes first)

1. `intented.near` exists and is ours, with no contract and no balance. Fund it with about **4 NEAR**: about 3.4 NEAR to store the wallet code (330 KB), plus its own code and state.
2. Create `intented-owner.near` (the demo wallet's owner) with about **5 NEAR**: the demo wallet's deposit of about 3.8 NEAR, plus gas and token storage. Create `intented-vendor.near` with a little NEAR for storage.
3. Keys go to the keychain and the password manager. Nothing goes in the repo.

## 3. Deploy the factory

```sh
cd contract/wallet && cargo near build non-reproducible-wasm
cd ../factory && cargo near build non-reproducible-wasm
near contract deploy intented.near use-file target/near/intented_factory.wasm \
  with-init-call new json-args "$(printf '{"code":"%s","ceilings":%s}' \
    "$(base64 < ../wallet/target/near/intented_wallet.wasm | tr -d '\n')" "$CEILINGS_JSON")" \
  prepaid-gas '300 Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-keychain send
```

`CEILINGS_JSON` holds the numbers from section 0. The `new` arguments are the ceilings design's; they follow the spec rows once those are agreed.

Check:
- `get_code_hash` equals base58 of the wallet wasm's sha256 from step 1.
- The ceilings view shows the agreed numbers.
- `get_min_deposit` is about 3.8 NEAR.

## 4. Create the demo wallet

1. On the machine the demo agent runs on: `pnpm intented init demo` (mainnet). It saves the agent's key there and prints the public key and the Create link.
2. The owner opens the link on the mainnet site and signs `create`, or signs it with near-cli:

```sh
near contract call-function as-transaction intented.near create json-args '{
  "name": "demo", "model_id": "Qwen/Qwen3.8-27B",
  "setup": { "signer": "0x835ab53d20294ef795906dff21ae4c045336aa26",
             "prompt_hash": "<mainnet prompt hash from step 1>",
             "mandate_hash": "<sha256 of the mainnet mandate>",
             "token_id": "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
             "token": { "symbol": "USDC", "decimals": 6, "caps": { "per_tx": "2000000", "daily": "5000000" } },
             "near_caps": { "per_tx": "1", "daily": "100" } },
  "agent_key": "ed25519:<from intented init>", "agent_allowance": "500000000000000000000000" }' \
  prepaid-gas '300 Tgas' attached-deposit '<get_min_deposit> yoctoNEAR' \
  sign-as intented-owner.near network-config mainnet sign-with-keychain send
```

Check:
- `get_wallets({"owner_id": "intented-owner.near"})` lists `demo.intented.near`.
- `list-keys demo.intented.near` shows only the agent's function-call key, and no full-access key.
- The account's `code_hash` equals the factory's.
- `get_config` shows the signer, the mainnet prompt hash, the mandate hash, the caps and the ceilings.

Before registering the signer through `new_with`, the attestation is checked off chain. Step 1's `pnpm attest` is that check.

## 5. Cross-chain settings (owner)

```sh
W=demo.intented.near; O=intented-owner.near
call() { near contract call-function as-transaction $W "$1" json-args "$2" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as $O network-config mainnet sign-with-keychain send; }
call set_one_click_key '{"public_key":"ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc"}'
call set_cross_chain '{"enabled":true}'
call allow_cross_chain_recipient '{"address":"<the vendor Base address, lowercase>"}'
```

Check: `get_config` shows 1Click's real key, cross-chain on and the one recipient.

## 6. Token storage and funding

1. Register `demo.intented.near` and `intented-vendor.near` on USDC: `storage_deposit` with `{"account_id": "<id>", "registration_only": true}` and 0.00125 NEAR attached, signed by the owner.
2. The owner sends the wallet **5 USDC**.
3. Check: `ft_balance_of` for the wallet returns `5000000`.

## 7. The mainnet API and site

1. William starts the mainnet API and site with the settings from section 0.
2. Store the mandate text with `POST /api/mandate`, then check that `GET /api/mandates/<hash>` hashes to the wallet's `mandate_hash`.
3. Check that the Create page shows the notice and the storage cost.

## 8. The payments

Run the demo agent against `demo.intented.near` and the mainnet API, with the paywall.

| # | Payment | Expected | Hash |
| --- | --- | --- | --- |
| 1 | Honest, NEAR-native: 0.10 USDC to `intented-vendor.near` | `ALLOW`; the vendor's USDC rises by 100000 | `<to fill>` |
| 2 | Poisoned: 10× to an attacker account, under the cap | `DENY`; `execute` refused, "verdict is not ALLOW"; no transfer | `<to fill>` |
| 3 | Honest through 1Click (KT4): 2 USDC to the vendor's Base address | `ALLOW`; the transfer to 1Click's deposit address; 1Click reports `SUCCESS` with a Base transaction | `<to fill>`, Base `<to fill>` |
| 4 | Poisoned through 1Click, to an address the mandate doesn't name | `DENY`, or refused by the recipient list; no transfer | `<to fill>` |
| 5 | Ceiling: the owner tries `set_token` with a per-payment cap above the ceiling | Refused by the wallet | `<to fill>` |

Check after each: the receipt in Activity shows the reason, the signer, the signature and the transaction. Payment 3 is the first real 1Click delivery. If 1Click fails to deliver, the README says so plainly, and payments 1 and 2 carry the demo.

## 9. Record it

1. Write a decision record, `docs/decisions/2026-11-11-mainnet.md`: the accounts, both wasm hashes, the ceilings, the signer, every transaction hash, and what was spent.
2. Update the README's Status with the mainnet hashes and the ceilings as the contract enforces them. Change "Not done: the first real payment on mainnet, through 1Click itself" to what actually happened.
3. If the signer changed, publish the attestation report in `docs/attestations/`.

## If something fails

| At | Do |
| --- | --- |
| Factory deploy (3) | The factory keeps its key: fix and redeploy, or `set_code`. No user wallets exist yet |
| Wallet creation (4) | A failed batch refunds the deposit to the owner. Fix and create again with a new name |
| Funding (6) | `withdraw` returns tokens to the owner, and it works while frozen |
| A payment does the wrong thing (8) | `freeze` at once, then `withdraw`. Stop and write it up before anything else. Never try to fix it live. The demo wallet's code can't be changed; make a new wallet with fixed factory code |
| 1Click doesn't deliver (8.3) | Keep the deposit hash and 1Click's status. Ask in 1Click's channel. The refund goes to the wallet, the quote's `refundTo` |
| The factory has a bug after users create wallets | `set_code` fixes it for new wallets only. Existing owners `freeze` and `withdraw`; the README and site say so |
