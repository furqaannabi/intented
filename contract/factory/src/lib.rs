//! The Intented wallet factory (testnet only for the hackathon).
//!
//! It stores the wallet code and makes a wallet in one call the owner signs:
//! create `<name>.<factory>`, fund it with the attached NEAR, deploy the code,
//! initialise it with `new_with` (the caller as owner, the wallet as its own
//! agent, the owner's settings), and optionally add the agent's function-call
//! key. It never adds a full-access key, so nobody can redeploy a wallet it
//! made. The code is fixed at init and its hash is public.
//! Decision: docs/decisions/2026-11-04-wallet-factory-on-testnet.md.

use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{LazyOption, LookupMap};
use near_sdk::{env, near, require, AccountId, Allowance, Gas, NearToken, PanicOnDefault, Promise, PublicKey};

/// Room for the wallet's own state above its code: settings, proposals, nonces.
const STATE_MARGIN: NearToken = NearToken::from_millinear(500);
const INIT_GAS: Gas = Gas::from_tgas(30);
const CALLBACK_GAS: Gas = Gas::from_tgas(10);
const MAX_PAGE: u32 = 100;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory {
    /// The wallet wasm; lazy, so it is only read when a wallet is made.
    code: LazyOption<Vec<u8>>,
    /// base58(sha256(code)), the form NEAR shows as an account's code_hash.
    code_hash: String,
    code_len: u64,
    /// The wallets each owner has created, in order; added when a create succeeds.
    wallets: LookupMap<AccountId, Vec<AccountId>>,
}

/// The stored state before `wallets` (deployed 4 November). Field order is the layout.
#[near(serializers = [borsh])]
struct FactoryV1 {
    code: LazyOption<Vec<u8>>,
    code_hash: String,
    code_len: u64,
}

#[near]
impl Factory {
    #[init]
    pub fn new(code: Base64VecU8) -> Self {
        require!(!code.0.is_empty(), "code must not be empty");
        let code_hash = near_sdk::bs58::encode(env::sha256(&code.0)).into_string();
        let code_len = code.0.len() as u64;
        Self { code: LazyOption::new(b"c", Some(code.0)), code_hash, code_len, wallets: LookupMap::new(b"w") }
    }

    /// One-time upgrade from the layout without `wallets`, listing the wallets
    /// created before it (`known`: owner, wallet). The factory account only.
    #[private]
    #[init(ignore_state)]
    pub fn migrate(known: Vec<(AccountId, AccountId)>) -> Self {
        require!(env::predecessor_account_id() == env::current_account_id(), "only the factory account may migrate");
        let old: FactoryV1 = env::state_read().unwrap_or_else(|| env::panic_str("no state to migrate"));
        let mut f = Self { code: old.code, code_hash: old.code_hash, code_len: old.code_len, wallets: LookupMap::new(b"w") };
        for (owner_id, wallet_id) in known {
            f.record(owner_id, wallet_id);
        }
        f
    }

    /// Replaces the code for wallets created from now on; wallets already made
    /// keep theirs (they have no full-access key). Only the factory account
    /// itself may call it; the new hash shows in get_code_hash.
    pub fn set_code(&mut self, code: Base64VecU8) {
        require!(env::predecessor_account_id() == env::current_account_id(), "only the factory account may replace the code");
        require!(!code.0.is_empty(), "code must not be empty");
        self.code_hash = near_sdk::bs58::encode(env::sha256(&code.0)).into_string();
        self.code_len = code.0.len() as u64;
        self.code.set(Some(code.0));
    }

    /// The wallets `owner_id` has created through this factory, oldest first;
    /// `limit` at most 100 (default 50).
    pub fn get_wallets(&self, owner_id: AccountId, from_index: Option<u32>, limit: Option<u32>) -> Vec<AccountId> {
        let from = from_index.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(50).min(MAX_PAGE) as usize;
        self.wallets.get(&owner_id).map(|w| w.iter().skip(from).take(limit).cloned().collect()).unwrap_or_default()
    }

    /// The code every wallet from this factory runs; compare with the wallet
    /// account's code_hash.
    pub fn get_code_hash(&self) -> String {
        self.code_hash.clone()
    }

    /// The least NEAR `create` accepts: the code's storage plus room for state.
    pub fn get_min_deposit(&self) -> U128 {
        U128(env::storage_byte_cost().as_yoctonear() * self.code_len as u128 + STATE_MARGIN.as_yoctonear())
    }

    /// Makes `<name>.<factory>`, owned by the caller. `setup` is the wallet's
    /// `Setup` (signer, prompt hash, mandate hash, token, caps), checked by the
    /// wallet's `new_with`. The attached NEAR funds the wallet.
    #[payable]
    pub fn create(&mut self, name: String, model_id: String, setup: Value, agent_key: Option<PublicKey>, agent_allowance: Option<U128>) -> Promise {
        let deposit = env::attached_deposit();
        require!(deposit.as_yoctonear() >= self.get_min_deposit().0, "deposit must be at least get_min_deposit()");
        require!(!name.is_empty() && !name.contains('.'), "name must be one non-empty label, with no dots");
        let wallet_id: AccountId = format!("{name}.{}", env::current_account_id())
            .parse()
            .unwrap_or_else(|_| env::panic_str("name must make a valid account id: lowercase letters, digits, - and _"));
        let owner_id = env::predecessor_account_id();

        let init = json!({ "owner_id": owner_id, "agent_id": wallet_id, "model_id": model_id, "setup": setup });
        let mut wallet = Promise::new(wallet_id.clone())
            .create_account()
            .transfer(deposit)
            .deploy_contract(self.code.get().clone().unwrap_or_else(|| env::panic_str("no code")))
            .function_call("new_with", serde_json::to_vec(&init).unwrap(), NearToken::from_yoctonear(0), INIT_GAS);
        if let Some(key) = agent_key {
            let allowance = agent_allowance
                .and_then(|a| Allowance::limited(NearToken::from_yoctonear(a.0)))
                .unwrap_or_else(|| env::panic_str("agent_allowance must be positive when agent_key is given"));
            wallet = wallet.add_access_key_allowance(key, allowance, wallet_id.clone(), "propose,execute");
        }
        wallet.then(
            Promise::new(env::current_account_id()).function_call(
                "on_created",
                serde_json::to_vec(&json!({ "owner_id": owner_id, "deposit": U128(deposit.as_yoctonear()), "wallet_id": wallet_id })).unwrap(),
                NearToken::from_yoctonear(0),
                CALLBACK_GAS,
            ),
        )
    }

    /// The create batch is all or nothing; if it failed, its deposit came back
    /// to the factory, so send it on to the owner.
    #[private]
    pub fn on_created(&mut self, owner_id: AccountId, deposit: U128, wallet_id: AccountId) -> bool {
        if near_sdk::is_promise_success() {
            env::log_str(&format!("created {wallet_id} for {owner_id}"));
            self.record(owner_id, wallet_id);
            true
        } else {
            Promise::new(owner_id).transfer(NearToken::from_yoctonear(deposit.0)).detach();
            false
        }
    }
}

impl Factory {
    fn record(&mut self, owner_id: AccountId, wallet_id: AccountId) {
        let mut list = self.wallets.get(&owner_id).cloned().unwrap_or_default();
        if !list.contains(&wallet_id) {
            list.push(wallet_id);
        }
        self.wallets.insert(owner_id, list);
    }
}

#[cfg(test)]
mod migrate_tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    #[test]
    fn migrate_keeps_the_code_and_lists_the_known_wallets() {
        let me: AccountId = "intented.testnet".parse().unwrap();
        testing_env!(VMContextBuilder::new().current_account_id(me.clone()).predecessor_account_id(me).build());
        let mut v1 = FactoryV1 { code: LazyOption::new(b"c", Some(b"\0asm v1".to_vec())), code_hash: "h1".into(), code_len: 7 };
        v1.code.flush();
        env::state_write(&v1);
        let owner: AccountId = "alice.testnet".parse().unwrap();
        let demo: AccountId = "demo.intented.testnet".parse().unwrap();
        let f = Factory::migrate(vec![(owner.clone(), demo.clone()), (owner.clone(), demo.clone())]);
        assert_eq!(f.get_code_hash(), "h1");
        assert_eq!(f.code.get().clone().unwrap(), b"\0asm v1".to_vec());
        assert_eq!(f.get_wallets(owner, None, None), vec![demo]);
    }
}
