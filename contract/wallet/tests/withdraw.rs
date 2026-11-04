//! withdraw: the owner's way out besides a judged execute. Factory wallets have
//! no full-access key, so without it a stuck wallet keeps the money.

mod common;
use common::*;
use near_sdk::json_types::U128;
use near_sdk::test_utils::get_created_receipts;
use std::panic::{catch_unwind, AssertUnwindSafe};

fn calls_to(receiver: &str) -> Vec<serde_json::Value> {
    get_created_receipts()
        .into_iter()
        .filter(|r| r.receiver_id.as_str() == receiver)
        .map(|r| serde_json::to_value(&r.actions).unwrap())
        .collect()
}

#[test]
fn the_owner_withdraws_a_token_to_themselves() {
    let mut w = wallet();
    let _ = w.withdraw(Some(USDC.parse().unwrap()), U128(1_000_000));
    let calls = calls_to(USDC);
    assert_eq!(calls.len(), 1);
    let fc = calls[0][0].as_object().and_then(|o| o.values().next()).unwrap().clone();
    assert_eq!(fc["method_name"], serde_json::json!(b"ft_transfer".to_vec()));
    let args: serde_json::Value = serde_json::from_slice(&serde_json::from_value::<Vec<u8>>(fc["args"].clone()).unwrap()).unwrap();
    assert_eq!(args, serde_json::json!({ "receiver_id": owner(), "amount": "1000000" }));
}

#[test]
fn the_owner_withdraws_near_to_themselves() {
    let mut w = wallet();
    let _ = w.withdraw(None, U128(1));
    assert!(calls_to(owner().as_str()).iter().any(|a| a.to_string().contains("Transfer")));
}

#[test]
fn nobody_but_the_owner_may_withdraw() {
    for caller in [agent(), stranger()] {
        let mut w = wallet();
        as_caller(caller.clone());
        let err = catch_unwind(AssertUnwindSafe(|| {
            let _ = w.withdraw(None, U128(1));
        }))
        .expect_err(&format!("{caller} withdrew"));
        assert!(err.downcast_ref::<String>().cloned().unwrap_or_default().contains("owner only"));
    }
}

#[test]
fn near_withdrawals_cannot_take_what_the_wallets_storage_needs() {
    let mut w = wallet();
    let balance = near_sdk::env::account_balance().as_yoctonear();
    let err = catch_unwind(AssertUnwindSafe(|| {
        let _ = w.withdraw(None, U128(balance));
    }))
    .expect_err("withdrew the whole balance, storage included");
    assert!(err.downcast_ref::<String>().cloned().unwrap_or_default().contains("storage"));
}
