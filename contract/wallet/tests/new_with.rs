//! new_with: the factory's one-call setup. The owner's settings arrive in the
//! create call they sign, since the factory is not the owner and can't call
//! the owner's setters afterwards.

mod common;
use common::*;
use intented_wallet::{Caps, Setup, Token, Wallet};
use near_sdk::json_types::U128;
use std::panic::{catch_unwind, AssertUnwindSafe};

const SIGNER: &str = "0x835ab53d20294ef795906dff21ae4c045336aa26";
const WRAP: &str = "wrap.testnet";

fn setup() -> Setup {
    Setup {
        signer: SIGNER.into(),
        prompt_hash: "cd".repeat(32),
        mandate_hash: Some("ab".repeat(32)),
        token_id: WRAP.parse().unwrap(),
        token: Token { symbol: "wNEAR".into(), decimals: 24, caps: Caps { per_tx: U128(10), daily: U128(50) } },
        near_caps: Caps { per_tx: U128(1), daily: U128(100) },
    }
}

#[test]
fn new_with_sets_up_the_wallet_with_the_owners_settings_in_one_call() {
    as_caller(owner());
    let w = Wallet::new_with(owner(), agent(), MODEL.into(), setup());
    let c = w.get_config();
    assert_eq!((c.owner_id, c.agent_id, c.model_id.as_str()), (owner(), agent(), MODEL));
    assert_eq!(c.signers, vec![SIGNER.to_string()]);
    assert_eq!(c.prompt_hash, Some("cd".repeat(32)));
    assert_eq!(c.mandate_hash, Some("ab".repeat(32)));
    assert_eq!(c.receivers, vec![WRAP.parse::<near_sdk::AccountId>().unwrap()]);
    assert_eq!(c.near_caps, Caps { per_tx: U128(1), daily: U128(100) });
    assert!(!c.cross_chain_enabled && !c.frozen);
    assert_eq!(w.get_token(WRAP.parse().unwrap()), Some(setup().token));
}

#[test]
fn new_with_refuses_settings_the_owners_setters_would_refuse() {
    let bad: Vec<(&str, Setup)> = vec![
        ("signer", Setup { signer: "0x12".into(), ..setup() }),
        ("prompt hash", Setup { prompt_hash: "CD".repeat(32), ..setup() }),
        ("mandate hash", Setup { mandate_hash: Some("ab".into()), ..setup() }),
        ("token caps", Setup { token: Token { caps: Caps { per_tx: U128(10), daily: U128(9) }, ..setup().token }, ..setup() }),
        ("symbol", Setup { token: Token { symbol: "w NEAR".into(), ..setup().token }, ..setup() }),
        ("near caps", Setup { near_caps: Caps { per_tx: U128(2), daily: U128(1) }, ..setup() }),
    ];
    for (name, s) in bad {
        as_caller(owner());
        assert!(catch_unwind(AssertUnwindSafe(|| Wallet::new_with(owner(), agent(), MODEL.into(), s))).is_err(), "accepted a bad {name}");
    }
}
