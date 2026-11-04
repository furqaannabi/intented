use intented_factory::Factory;
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::test_utils::{get_created_receipts, VMContextBuilder};
use near_sdk::{test_vm_config, testing_env, AccountId, NearToken, PromiseResult, RuntimeFeesConfig};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::panic::{catch_unwind, AssertUnwindSafe};

const FACTORY: &str = "intented.testnet";
const CODE: &[u8] = b"\0asm stand-in for the wallet wasm";
const KEY: &str = "ed25519:E7F6MXsZaYD3CWvJQvG1GoofRHpY8yRPRjx2PssbQTyT";

fn owner() -> AccountId { "alice.testnet".parse().unwrap() }

fn ctx(caller: AccountId, deposit: NearToken) {
    testing_env!(VMContextBuilder::new().current_account_id(FACTORY.parse().unwrap()).predecessor_account_id(caller).attached_deposit(deposit).build());
}

fn factory() -> Factory {
    ctx(FACTORY.parse().unwrap(), NearToken::from_yoctonear(0));
    Factory::new(Base64VecU8(CODE.to_vec()))
}

fn setup() -> Value {
    json!({ "signer": "0x835ab53d20294ef795906dff21ae4c045336aa26", "prompt_hash": "cd".repeat(32), "mandate_hash": null,
            "token_id": "wrap.testnet", "token": { "symbol": "wNEAR", "decimals": 24, "caps": { "per_tx": "10", "daily": "50" } },
            "near_caps": { "per_tx": "1", "daily": "100" } })
}

fn enough(f: &Factory) -> NearToken {
    NearToken::from_yoctonear(f.get_min_deposit().0)
}

/// The actions of the receipt sent to `to`, each as { kind: fields }.
fn actions_to(to: &str) -> Vec<Value> {
    get_created_receipts().into_iter().filter(|r| r.receiver_id.as_str() == to).flat_map(|r| serde_json::to_value(&r.actions).unwrap().as_array().unwrap().clone()).collect()
}

fn kinds(actions: &[Value]) -> Vec<String> {
    actions.iter().map(|a| a.as_object().unwrap().keys().next().unwrap().clone()).collect()
}

#[test]
fn create_makes_a_configured_wallet_with_the_caller_as_owner_and_no_full_access_key() {
    let mut f = factory();
    let deposit = enough(&f);
    ctx(owner(), deposit);
    let _ = f.create("shop".into(), "Qwen/Qwen3.8-27B".into(), setup(), Some(KEY.parse().unwrap()), Some(U128(250_000_000_000_000_000_000_000)));

    let a = actions_to("shop.intented.testnet");
    assert_eq!(kinds(&a), ["CreateAccount", "Transfer", "DeployContract", "FunctionCallWeight", "AddKeyWithFunctionCall"]);
    assert_eq!(a[1]["Transfer"]["deposit"], json!(deposit.as_yoctonear().to_string()));
    assert_eq!(a[2]["DeployContract"]["code"], json!(CODE.to_vec()));
    let call = &a[3]["FunctionCallWeight"];
    assert_eq!(call["method_name"], json!(b"new_with".to_vec()));
    let args: Value = serde_json::from_slice(&serde_json::from_value::<Vec<u8>>(call["args"].clone()).unwrap()).unwrap();
    assert_eq!(args["owner_id"], "alice.testnet");
    assert_eq!(args["agent_id"], "shop.intented.testnet");
    assert_eq!(args["model_id"], "Qwen/Qwen3.8-27B");
    assert_eq!(args["setup"], setup());
    let key = &a[4]["AddKeyWithFunctionCall"];
    assert_eq!(key["receiver_id"], "shop.intented.testnet");
    assert_eq!(key["method_names"], json!(["propose", "execute"]));
}

#[test]
fn create_without_an_agent_key_adds_no_key_at_all() {
    let mut f = factory();
    ctx(owner(), enough(&f));
    let _ = f.create("shop".into(), "m".into(), setup(), None, None);
    assert_eq!(kinds(&actions_to("shop.intented.testnet")), ["CreateAccount", "Transfer", "DeployContract", "FunctionCallWeight"]);
}

#[test]
fn create_refuses_too_little_deposit_and_bad_names() {
    let f0 = factory();
    let short = NearToken::from_yoctonear(f0.get_min_deposit().0 - 1);
    for (name, deposit, why) in [("shop", short, "deposit"), ("a.b", enough(&f0), "name"), ("Shop", enough(&f0), "name"), ("", enough(&f0), "name")] {
        let mut f = factory();
        ctx(owner(), deposit);
        let err = catch_unwind(AssertUnwindSafe(|| { let _ = f.create(name.into(), "m".into(), setup(), None, None); })).expect_err(name);
        assert!(err.downcast_ref::<String>().cloned().unwrap_or_default().contains(why), "{name}");
    }
}

#[test]
fn the_min_deposit_covers_the_wallets_code_and_the_code_hash_is_nears() {
    let f = factory();
    assert!(f.get_min_deposit().0 >= CODE.len() as u128 * near_sdk::env::storage_byte_cost().as_yoctonear());
    assert_eq!(f.get_code_hash(), near_sdk::bs58::encode(near_sdk::env::sha256(CODE)).into_string());
}

#[test]
fn a_failed_create_refunds_the_owner() {
    let mut f = factory();
    let me: AccountId = FACTORY.parse().unwrap();
    testing_env!(VMContextBuilder::new().current_account_id(me.clone()).predecessor_account_id(me).build(), test_vm_config(), RuntimeFeesConfig::test(), HashMap::default(), vec![PromiseResult::Failed]);
    assert!(!f.on_created(owner(), U128(7), "shop.intented.testnet".parse().unwrap()));
    let refund = actions_to("alice.testnet");
    assert_eq!(refund.len(), 1);
    assert_eq!(refund[0]["Transfer"]["deposit"], json!("7"));
}

#[test]
fn only_the_factory_account_replaces_the_code_for_new_wallets() {
    let mut f = factory();
    let new_code = b"\0asm the next wallet version".to_vec();
    ctx(owner(), NearToken::from_yoctonear(0));
    assert!(catch_unwind(AssertUnwindSafe(|| f.set_code(Base64VecU8(new_code.clone())))).is_err(), "a stranger replaced the code");
    ctx(FACTORY.parse().unwrap(), NearToken::from_yoctonear(0));
    f.set_code(Base64VecU8(new_code.clone()));
    assert_eq!(f.get_code_hash(), near_sdk::bs58::encode(near_sdk::env::sha256(&new_code)).into_string());
    ctx(owner(), enough(&f));
    let _ = f.create("next".into(), "m".into(), setup(), None, None);
    assert_eq!(actions_to("next.intented.testnet")[2]["DeployContract"]["code"], json!(new_code));
}

// get_wallets: the wallets an owner has created, recorded when a create succeeds.

fn callback(result: PromiseResult) {
    let me: AccountId = FACTORY.parse().unwrap();
    testing_env!(VMContextBuilder::new().current_account_id(me.clone()).predecessor_account_id(me).build(), test_vm_config(), RuntimeFeesConfig::test(), HashMap::default(), vec![result]);
}

fn wallet_id(name: &str) -> AccountId {
    format!("{name}.{FACTORY}").parse().unwrap()
}

#[test]
fn a_successful_create_is_listed_under_its_owner_and_a_failed_one_is_not() {
    let mut f = factory();
    callback(PromiseResult::Successful(vec![]));
    assert!(f.on_created(owner(), U128(1), wallet_id("shop")));
    callback(PromiseResult::Failed);
    assert!(!f.on_created(owner(), U128(1), wallet_id("gone")));
    callback(PromiseResult::Successful(vec![]));
    assert!(f.on_created(owner(), U128(1), wallet_id("cafe")));

    assert_eq!(f.get_wallets(owner(), None, None), vec![wallet_id("shop"), wallet_id("cafe")]);
    assert!(f.get_wallets("nobody.testnet".parse().unwrap(), None, None).is_empty());
}

#[test]
fn get_wallets_pages() {
    let mut f = factory();
    for n in 0..5 {
        callback(PromiseResult::Successful(vec![]));
        f.on_created(owner(), U128(1), wallet_id(&format!("w{n}")));
    }
    assert_eq!(f.get_wallets(owner(), Some(1), Some(2)), vec![wallet_id("w1"), wallet_id("w2")]);
    assert_eq!(f.get_wallets(owner(), Some(4), Some(50)), vec![wallet_id("w4")]);
    assert!(f.get_wallets(owner(), Some(9), None).is_empty());
}
