//! The amount the contract requires the model to have been shown must equal
//! the firewall core's formatting. amount_fixture.json is written by
//! firewall-core/scripts/canonical-fixture.ts.

use intented_wallet::format_amount;
use serde_json::Value;

#[test]
fn contract_formats_amounts_exactly_like_the_firewall_core() {
    let cases: Vec<Value> = serde_json::from_str(include_str!("amount_fixture.json")).unwrap();
    assert!(cases.len() >= 10);
    for c in cases {
        let raw: u128 = c["raw"].as_str().unwrap().parse().unwrap();
        let decimals = c["decimals"].as_u64().unwrap() as u8;
        assert_eq!(format_amount(raw, decimals, c["symbol"].as_str().unwrap()), c["shown"].as_str().unwrap(), "{c}");
    }
}
