//! The contract's canonical bytes must equal the firewall core's, byte for byte.
//! canonical_fixture.json is written by firewall-core/scripts/canonical-fixture.ts.

use intented_wallet::Action;
use serde_json::Value;

#[test]
fn contract_encodes_exactly_like_the_firewall_core() {
    let cases: Vec<Value> = serde_json::from_str(include_str!("canonical_fixture.json")).unwrap();
    assert!(cases.len() >= 5);
    for case in cases {
        let action: Action = serde_json::from_value(case["action"].clone()).unwrap();
        let expected = case["canonical"].as_str().unwrap();
        assert_eq!(String::from_utf8(action.canonical_bytes()).unwrap(), expected);
    }
}
