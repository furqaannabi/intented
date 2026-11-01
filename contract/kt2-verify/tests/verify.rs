use kt2_verify::Contract;
use near_sdk::json_types::Base64VecU8;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId};
use serde_json::Value;

fn fixture() -> Value {
    serde_json::from_str(include_str!("fixture.json")).unwrap()
}

fn s(f: &Value, k: &str) -> String {
    f[k].as_str().unwrap().to_string()
}

fn b64(f: &Value, k: &str) -> Base64VecU8 {
    serde_json::from_value(f[k].clone()).unwrap()
}

fn owner() -> AccountId {
    "owner.testnet".parse().unwrap()
}

/// A contract set up for the fixture's model, with the fixture's signer allowlisted.
fn contract(model: Option<String>) -> Contract {
    testing_env!(VMContextBuilder::new().predecessor_account_id(owner()).build());
    let mut c = Contract::new(owner(), model);
    c.register_signer(s(&fixture(), "signer"));
    c
}

#[test]
fn allowlisted_signature_over_exact_bytes_verifies() {
    let f = fixture();
    let c = contract(Some(s(&f, "model")));
    assert!(c.verify(b64(&f, "request_b64"), b64(&f, "response_b64"), s(&f, "signature")));
}

fn flip_one_byte(mut b: Base64VecU8) -> Base64VecU8 {
    let mid = b.0.len() / 2;
    b.0[mid] ^= 0x01;
    b
}

#[test]
fn one_flipped_byte_in_request_fails() {
    let f = fixture();
    let c = contract(Some(s(&f, "model")));
    assert!(!c.verify(flip_one_byte(b64(&f, "request_b64")), b64(&f, "response_b64"), s(&f, "signature")));
}

#[test]
fn one_flipped_byte_in_response_fails() {
    let f = fixture();
    let c = contract(Some(s(&f, "model")));
    assert!(!c.verify(b64(&f, "request_b64"), flip_one_byte(b64(&f, "response_b64")), s(&f, "signature")));
}

#[test]
fn valid_signature_from_unknown_signer_fails() {
    let f = fixture();
    let c = contract(Some(s(&f, "model")));
    assert!(!c.verify(b64(&f, "request_b64"), b64(&f, "response_b64"), s(&f, "stranger_signature")));
}

#[test]
fn signature_over_a_different_model_fails() {
    let f = fixture();
    let c = contract(Some(s(&f, "model")));
    assert!(!c.verify(b64(&f, "request_b64"), b64(&f, "response_b64"), s(&f, "other_model_signature")));
}

#[test]
fn gateway_signature_verifies_when_no_model_is_set() {
    let f = fixture();
    let c = contract(None);
    assert!(c.verify(b64(&f, "request_b64"), b64(&f, "response_b64"), s(&f, "gateway_signature")));
    assert!(!c.verify(b64(&f, "request_b64"), b64(&f, "response_b64"), s(&f, "signature")));
}

#[test]
fn malformed_signatures_fail_without_panicking() {
    let f = fixture();
    let c = contract(Some(s(&f, "model")));
    let good = s(&f, "signature");
    let malformed = [
        String::new(),
        "0x".to_string(),
        "not hex".to_string(),
        good[..good.len() - 2].to_string(),           // 64 bytes
        format!("{good}00"),                          // 66 bytes
        format!("{}05", &good[..good.len() - 2]),     // v out of range
        format!("0x{}", "00".repeat(65)),             // zero r, s
    ];
    for sig in malformed {
        assert!(!c.verify(b64(&f, "request_b64"), b64(&f, "response_b64"), sig.clone()), "accepted {sig:?}");
    }
}

// Real NEAR AI Cloud artifacts from KT1 (firewall-core/scripts/kt1.ts):
// one completion with Qwen's reasoning trace (8.6 KB response), one without.
fn real(run: &str) -> Value {
    let all: Value = serde_json::from_str(include_str!("kt1_real.json")).unwrap();
    all[run].clone()
}

fn real_contract(r: &Value) -> Contract {
    testing_env!(VMContextBuilder::new().predecessor_account_id(owner()).build());
    let mut c = Contract::new(owner(), Some(s(r, "model")));
    c.register_signer(s(r, "signing_address"));
    c
}

#[test]
fn real_near_ai_signatures_verify() {
    for run in ["no_thinking", "thinking"] {
        let r = real(run);
        let c = real_contract(&r);
        assert!(c.verify(b64(&r, "request_b64"), b64(&r, "response_b64"), s(&r, "signature")), "{run}");
    }
}

#[test]
fn real_near_ai_signatures_fail_with_one_flipped_byte() {
    for run in ["no_thinking", "thinking"] {
        let r = real(run);
        let c = real_contract(&r);
        assert!(!c.verify(flip_one_byte(b64(&r, "request_b64")), b64(&r, "response_b64"), s(&r, "signature")), "{run} req");
        assert!(!c.verify(b64(&r, "request_b64"), flip_one_byte(b64(&r, "response_b64")), s(&r, "signature")), "{run} resp");
    }
}
