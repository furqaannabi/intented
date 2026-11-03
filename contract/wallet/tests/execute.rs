//! execute: runs a proposal only with a TEE-signed ALLOW for exactly that
//! action, under the owner's mandate and our prompt, within the caps.
//! execute_fixture.json is written by firewall-core/scripts/execute-fixture.ts.

mod common;
use common::*;
use intented_wallet::{Action, Caps, ProposalStatus, Token, Wallet};
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::test_utils::get_created_receipts;
use serde_json::Value;

fn fixture() -> Value {
    serde_json::from_str(include_str!("execute_fixture.json")).unwrap()
}

fn case(name: &str) -> Value {
    let c = fixture()["cases"][name].clone();
    assert!(!c.is_null(), "no fixture case {name}");
    c
}

/// A wallet configured as the fixture expects: its signer, mandate, prompt,
/// USDC allowlisted with 5 USDC per call and 20 a day, and 1 yoctoNEAR per call.
fn configured() -> Wallet {
    let f = fixture();
    let mut w = wallet();
    w.register_signer(f["signer"].as_str().unwrap().into());
    w.set_mandate(f["mandate_hash"].as_str().unwrap().into());
    w.set_prompt_hash(f["prompt_hash"].as_str().unwrap().into());
    w.allow_receiver(USDC.parse().unwrap());
    w.set_token(USDC.parse().unwrap(), usdc(5_000_000, 20_000_000));
    w.set_near_caps(Caps { per_tx: U128(1), daily: U128(100) });
    w
}

/// Testnet USDC as the firewall core knows it: symbol USDC, 6 decimals.
fn usdc(per_tx: u128, daily: u128) -> Token {
    Token { symbol: "USDC".into(), decimals: 6, caps: Caps { per_tx: U128(per_tx), daily: U128(daily) } }
}

fn propose_case(w: &mut Wallet, c: &Value) -> u64 {
    let action: Action = serde_json::from_value(c["action"].clone()).unwrap();
    as_caller(agent());
    w.propose(action, c["args_json"].as_str().unwrap().into())
}

fn b64(c: &Value, k: &str) -> Base64VecU8 {
    serde_json::from_value(c[k].clone()).unwrap()
}

fn execute_case(w: &mut Wallet, id: u64, c: &Value) {
    as_caller(agent());
    let _ = w.execute(id, b64(c, "req_b64"), b64(c, "resp_b64"), c["sig"].as_str().unwrap().into());
}

#[test]
fn a_signed_allow_sends_exactly_the_proposed_call() {
    let mut w = configured();
    let c = case("allow");
    let id = propose_case(&mut w, &c);
    execute_case(&mut w, id, &c);

    assert_eq!(w.get_proposal(id).unwrap().status, ProposalStatus::Allowed);
    let receipts = get_created_receipts();
    let call = receipts.iter().find(|r| r.receiver_id.as_str() == USDC).expect("a call to the token");
    let action = serde_json::to_value(&call.actions).unwrap();
    let fc = action[0].as_object().and_then(|o| o.values().next()).unwrap();
    assert_eq!(fc["method_name"], serde_json::json!(b"ft_transfer".to_vec()));
    assert_eq!(fc["args"], serde_json::json!(c["args_json"].as_str().unwrap().as_bytes().to_vec()));
    assert_eq!(fc["attached_deposit"].as_str().or(fc["attached_deposit"].as_u64().map(|_| "1")), Some("1"));
}

use std::panic::{catch_unwind, AssertUnwindSafe};

/// Proposes `name`'s action, executes it with `name`'s signed verdict, and
/// expects a panic containing `why`, with nothing sent and the proposal still pending.
fn rejects_with(w: &mut Wallet, name: &str, why: &str) {
    let c = case(name);
    let id = propose_case(w, &c);
    let before = get_created_receipts().len();
    let err = catch_unwind(AssertUnwindSafe(|| execute_case(w, id, &c))).expect_err(&format!("{name} executed"));
    let msg = err.downcast_ref::<String>().cloned().unwrap_or_default();
    assert!(msg.contains(why), "{name}: expected '{why}', got '{msg}'");
    assert_eq!(get_created_receipts().len(), before, "{name} sent a call");
}

fn rejects(name: &str, why: &str) {
    rejects_with(&mut configured(), name, why);
}

#[test]
fn a_signature_from_an_unknown_signer_is_rejected() {
    rejects("unknown_signer", "signer is not allowlisted");
}

#[test]
fn one_flipped_byte_in_the_request_or_response_is_rejected() {
    for k in ["req_b64", "resp_b64"] {
        let mut w = configured();
        let mut c = case("allow");
        let mut bytes = b64(&c, k).0;
        let mid = bytes.len() / 2;
        bytes[mid] ^= 0x01;
        c[k] = serde_json::to_value(Base64VecU8(bytes)).unwrap();
        let id = propose_case(&mut w, &c);
        let err = catch_unwind(AssertUnwindSafe(|| execute_case(&mut w, id, &c))).expect_err(k);
        let msg = err.downcast_ref::<String>().cloned().unwrap_or_default();
        assert!(!msg.is_empty(), "{k}: rejected without a reason");
    }
}

#[test]
fn a_deny_or_a_verdict_that_is_not_exact_json_is_rejected() {
    rejects("deny", "verdict is not ALLOW");
    rejects("unparseable_content", "verdict is not valid JSON");
}

#[test]
fn a_verdict_for_a_different_action_is_rejected() {
    rejects("verdict_for_other_action", "verdict is for a different action");
}

#[test]
fn a_verdict_given_under_another_mandate_prompt_or_model_is_rejected() {
    rejects("fake_mandate", "mandate");
    rejects("fake_system_prompt", "system prompt");
    rejects("other_model", "model");
}

#[test]
fn a_verdict_on_other_args_or_another_action_than_the_proposal_is_rejected() {
    rejects("other_args_shown", "args");
    rejects("other_action_shown", "action");
}

#[test]
fn a_request_with_anything_the_firewall_core_does_not_send_is_rejected() {
    rejects("extra_user_field", "request");
    rejects("extra_message", "two messages");
    rejects("logit_bias", "request");
    rejects("allow_only_schema", "response_format");
    rejects("thinking_on", "thinking");
    rejects("temperature_1", "temperature");
    rejects("duplicate_model_key", "request");
}

use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const DAY_MS: u64 = 86_400_000;

/// The agent calls next, at `ms` since the epoch.
fn agent_at(ms: u64) {
    testing_env!(VMContextBuilder::new().predecessor_account_id(agent()).block_timestamp(ms * 1_000_000).build());
}

fn try_execute(w: &mut Wallet, id: u64, c: &Value) -> Result<(), String> {
    catch_unwind(AssertUnwindSafe(|| {
        let _ = w.execute(id, b64(c, "req_b64"), b64(c, "resp_b64"), c["sig"].as_str().unwrap().into());
    }))
    .map_err(|e| e.downcast_ref::<String>().cloned().unwrap_or_default())
}

#[test]
fn a_reused_nonce_is_rejected() {
    let mut w = configured();
    let c = case("allow");
    let first = propose_case(&mut w, &c);
    let second = propose_case(&mut w, &c);
    execute_case(&mut w, first, &c);
    agent_at(0);
    let err = try_execute(&mut w, second, &c).expect_err("second use of nonce 1");
    assert!(err.contains("nonce already used"), "{err}");
}

#[test]
fn a_proposal_cannot_be_executed_twice() {
    let mut w = configured();
    let c = case("allow");
    let id = propose_case(&mut w, &c);
    execute_case(&mut w, id, &c);
    agent_at(0);
    let err = try_execute(&mut w, id, &c).expect_err("executed twice");
    assert!(err.contains("not pending"), "{err}");
}

#[test]
fn an_expired_action_is_rejected() {
    let mut w = configured();
    let c = case("expired"); // expiry_ms = 1000
    let id = propose_case(&mut w, &c);
    agent_at(1_001);
    let err = try_execute(&mut w, id, &c).expect_err("expired action executed");
    assert!(err.contains("expired"), "{err}");
}

#[test]
fn a_receiver_off_the_allowlist_is_rejected() {
    let mut w = configured();
    w.disallow_receiver(USDC.parse().unwrap());
    rejects_with(&mut w, "allow", "receiver is not allowlisted");
}

#[test]
fn a_frozen_wallet_executes_nothing() {
    let mut w = configured();
    w.freeze();
    rejects_with(&mut w, "allow", "frozen");
}

#[test]
fn only_the_agent_may_execute() {
    let mut w = configured();
    let c = case("allow");
    let id = propose_case(&mut w, &c);
    as_caller(owner());
    let err = try_execute(&mut w, id, &c).expect_err("owner executed");
    assert!(err.contains("agent only"), "{err}");
}

#[test]
fn a_token_amount_over_the_per_transaction_cap_is_rejected() {
    rejects("over_per_tx_cap", "over the per-transaction cap"); // 6 USDC > 5
}

#[test]
fn a_near_deposit_over_its_cap_is_rejected() {
    rejects("near_deposit", "over the per-transaction cap"); // 1 NEAR > 1 yoctoNEAR
}

#[test]
fn a_token_transfer_without_caps_or_a_readable_amount_is_rejected() {
    let mut w = configured();
    w.set_token(USDC.parse().unwrap(), usdc(0, 0));
    rejects_with(&mut w, "allow", "over the per-transaction cap");

    let mut w = wallet();
    let f = fixture();
    w.register_signer(f["signer"].as_str().unwrap().into());
    w.set_mandate(f["mandate_hash"].as_str().unwrap().into());
    w.set_prompt_hash(f["prompt_hash"].as_str().unwrap().into());
    w.allow_receiver(USDC.parse().unwrap());
    w.set_near_caps(Caps { per_tx: U128(1), daily: U128(100) });
    rejects_with(&mut w, "allow", "no caps set for this token");

    rejects("no_amount", "amount");
    rejects("numeric_amount", "amount");
}

#[test]
fn the_daily_cap_holds_within_a_utc_day_and_resets_at_midnight() {
    let mut w = configured();
    as_caller(owner());
    w.set_token(USDC.parse().unwrap(), usdc(1_000_000, 2_000_000));
    let day = 20_000 * DAY_MS;
    for name in ["allow", "allow_nonce_2"] {
        let c = case(name);
        let id = propose_case(&mut w, &c);
        agent_at(day + 1_000);
        try_execute(&mut w, id, &c).unwrap_or_else(|e| panic!("{name}: {e}"));
    }
    let c = case("allow_nonce_3");
    let id = propose_case(&mut w, &c);
    agent_at(day + DAY_MS - 1);
    let err = try_execute(&mut w, id, &c).expect_err("third USDC on the same day");
    assert!(err.contains("over the daily cap"), "{err}");
    agent_at(day + DAY_MS);
    try_execute(&mut w, id, &c).expect("a new UTC day resets the cap");
}

use near_sdk::{test_vm_config, PromiseResult, RuntimeFeesConfig};
use std::collections::HashMap;

/// The wallet's own callback runs next, seeing `result` as the call's outcome.
fn callback_sees(result: PromiseResult) {
    let me: near_sdk::AccountId = "wallet.testnet".parse().unwrap();
    testing_env!(
        VMContextBuilder::new().current_account_id(me.clone()).predecessor_account_id(me).build(),
        test_vm_config(),
        RuntimeFeesConfig::test(),
        HashMap::default(),
        vec![result]
    );
}

#[test]
fn the_callback_records_whether_the_call_succeeded() {
    // Different nonces: the mock keeps storage between wallets in one test.
    for (result, expected, name) in [
        (PromiseResult::Successful(vec![]), ProposalStatus::Executed, "allow"),
        (PromiseResult::Failed, ProposalStatus::Failed, "allow_nonce_2"),
    ] {
        let mut w = configured();
        let c = case(name);
        let id = propose_case(&mut w, &c);
        execute_case(&mut w, id, &c);
        callback_sees(result);
        w.on_executed(id);
        assert_eq!(w.get_proposal(id).unwrap().status, expected);
    }
}

#[test]
fn a_request_showing_the_model_a_false_amount_or_none_is_rejected() {
    rejects("wrong_amount_shown", "amount");
    rejects("no_amount_shown", "amount");
}

// Payments through 1Click: execute's cross-chain conditions (interface spec, check 6).

fn cross_chain_on() -> Wallet {
    let mut w = configured();
    as_caller(owner());
    w.set_cross_chain(true);
    w
}

#[test]
fn a_cross_chain_payment_is_refused_while_the_switch_is_off() {
    rejects("cc_ok", "cross-chain payments are off");
}

#[test]
fn with_the_switch_on_a_cross_chain_payment_sends_the_transfer_to_the_deposit_address() {
    let mut w = cross_chain_on();
    let c = case("cc_ok");
    let id = propose_case(&mut w, &c);
    execute_case(&mut w, id, &c);
    assert_eq!(w.get_proposal(id).unwrap().status, ProposalStatus::Allowed);
    let call = get_created_receipts().into_iter().find(|r| r.receiver_id.as_str() == USDC).expect("a call to the token");
    let fc = serde_json::to_value(&call.actions).unwrap();
    let fc = fc[0].as_object().and_then(|o| o.values().next()).unwrap().clone();
    assert_eq!(fc["args"], serde_json::json!(c["args_json"].as_str().unwrap().as_bytes().to_vec()));
}

#[test]
fn each_cross_chain_condition_is_enforced() {
    for (name, why) in [
        ("cc_method", "ft_transfer"),
        ("cc_deposit_mismatch", "deposit_address"),
        ("cc_recipient_uppercase", "recipient"),
        ("cc_recipient_short", "recipient"),
        ("cc_deadline_at_expiry", "deadline_ms"),
        ("cc_deadline_not_decimal", "deadline_ms"),
        ("cc_extra_field", "request"),
    ] {
        rejects_with(&mut cross_chain_on(), name, why);
    }
}

#[test]
fn a_non_empty_recipient_list_refuses_any_other_recipient_even_on_an_allow() {
    let vendor = case("cc_ok")["cross_chain_recipient"].as_str().unwrap().to_string();
    let mut w = cross_chain_on();
    w.allow_cross_chain_recipient(vendor.clone());
    rejects_with(&mut w, "cc_other_recipient", "not on the cross-chain recipient list");

    let mut w = cross_chain_on();
    w.allow_cross_chain_recipient(vendor);
    let c = case("cc_ok");
    let id = propose_case(&mut w, &c);
    agent_at(0);
    try_execute(&mut w, id, &c).expect("the listed recipient is paid");
}
