//! The agent's key, added by the wallet to itself: a function-call key on the
//! wallet account, scoped to propose and execute, with a NEAR allowance for gas.

mod common;
use common::*;
use near_sdk::json_types::U128;
use near_sdk::test_utils::get_created_receipts;
use near_sdk::PublicKey;
use std::panic::{catch_unwind, AssertUnwindSafe};

const KEY: &str = "ed25519:E7F6MXsZaYD3CWvJQvG1GoofRHpY8yRPRjx2PssbQTyT";
const ME: &str = "alice.near"; // the wallet's own account in near-sdk's test context

fn key() -> PublicKey {
    KEY.parse().unwrap()
}

fn actions_on_self() -> Vec<serde_json::Value> {
    get_created_receipts().into_iter().filter(|r| r.receiver_id.as_str() == ME).flat_map(|r| serde_json::to_value(&r.actions).unwrap().as_array().unwrap().clone()).collect()
}

#[test]
fn the_owner_adds_a_key_scoped_to_propose_and_execute_on_the_wallet() {
    let mut w = wallet();
    let _ = w.add_agent_key(key(), U128(250_000_000_000_000_000_000_000));
    let added = actions_on_self().into_iter().find_map(|a| a.get("AddKeyWithFunctionCall").cloned()).expect("a function-call key");
    assert_eq!(added["receiver_id"], ME);
    assert_eq!(added["method_names"], serde_json::json!(["propose", "execute"]));
    assert_eq!(added["allowance"], "250000000000000000000000");
    assert!(actions_on_self().iter().all(|a| a.get("AddKeyWithFullAccess").is_none()));
}

#[test]
fn the_owner_removes_the_key() {
    let mut w = wallet();
    let _ = w.remove_agent_key(key());
    assert!(actions_on_self().iter().any(|a| a.get("DeleteKey").is_some()));
}

#[test]
fn only_the_owner_manages_agent_keys_and_the_allowance_must_be_limited() {
    for caller in [agent(), stranger()] {
        let mut w = wallet();
        as_caller(caller.clone());
        assert!(catch_unwind(AssertUnwindSafe(|| { let _ = w.add_agent_key(key(), U128(1)); })).is_err(), "{caller} added a key");
        let mut w = wallet();
        as_caller(caller.clone());
        assert!(catch_unwind(AssertUnwindSafe(|| { let _ = w.remove_agent_key(key()); })).is_err(), "{caller} removed a key");
    }
    let mut w = wallet();
    let err = catch_unwind(AssertUnwindSafe(|| { let _ = w.add_agent_key(key(), U128(0)); })).expect_err("zero allowance accepted");
    assert!(err.downcast_ref::<String>().cloned().unwrap_or_default().contains("allowance"));
}
