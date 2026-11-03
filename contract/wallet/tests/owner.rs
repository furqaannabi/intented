mod common;
use common::*;

#[test]
fn owner_can_freeze() {
    let mut w = wallet();
    w.freeze();
    assert!(w.is_frozen());
}

#[test]
#[should_panic(expected = "owner only")]
fn agent_cannot_freeze() {
    let mut w = wallet();
    as_caller(agent());
    w.freeze();
}

use intented_wallet::{Caps, Token};
use near_sdk::json_types::U128;
use std::panic::{catch_unwind, AssertUnwindSafe};

const SIGNER: &str = "0x835AB53D20294EF795906DFF21AE4C045336AA26";
const BASE_RECIPIENT: &str = "0x2ef2fed3f9b3d5385499008051031320b1fb49ef";
const USDC: &str = "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af";

fn caps(per_tx: u128, daily: u128) -> Caps {
    Caps { per_tx: U128(per_tx), daily: U128(daily) }
}

fn usdc(per_tx: u128, daily: u128) -> Token {
    Token { symbol: "USDC".into(), decimals: 6, caps: caps(per_tx, daily) }
}

#[test]
fn owner_configures_the_wallet() {
    let mut w = wallet();
    w.set_mandate("ab".repeat(32));
    w.set_prompt_hash("cd".repeat(32));
    w.register_signer(SIGNER.into());
    w.allow_receiver(USDC.parse().unwrap());
    w.set_token(USDC.parse().unwrap(), usdc(5_000_000, 20_000_000));
    w.set_near_caps(caps(1, 10));
    w.freeze();
    w.unfreeze();
    w.set_cross_chain(true);
    w.allow_cross_chain_recipient(BASE_RECIPIENT.into());

    let c = w.get_config();
    assert!(c.cross_chain_enabled);
    assert_eq!(c.cross_chain_recipients, vec![BASE_RECIPIENT.to_string()]);
    assert_eq!(c.mandate_hash.as_deref(), Some("ab".repeat(32).as_str()));
    assert_eq!(c.prompt_hash.as_deref(), Some("cd".repeat(32).as_str()));
    assert_eq!(c.model_id, MODEL);
    assert_eq!(c.signers, vec![SIGNER.to_lowercase()]);
    assert_eq!(c.receivers, vec![USDC.parse::<near_sdk::AccountId>().unwrap()]);
    assert_eq!(c.near_caps, caps(1, 10));
    assert!(!c.frozen);
    assert_eq!(w.get_token(USDC.parse().unwrap()), Some(usdc(5_000_000, 20_000_000)));

    w.revoke_signer(SIGNER.into());
    w.disallow_receiver(USDC.parse().unwrap());
    w.disallow_cross_chain_recipient(BASE_RECIPIENT.into());
    w.set_cross_chain(false);
    let c = w.get_config();
    assert!(c.signers.is_empty() && c.receivers.is_empty() && c.cross_chain_recipients.is_empty() && !c.cross_chain_enabled);
}

#[test]
fn every_owner_method_refuses_other_callers() {
    let calls: Vec<(&str, Box<dyn Fn(&mut intented_wallet::Wallet)>)> = vec![
        ("set_mandate", Box::new(|w| w.set_mandate("ab".repeat(32)))),
        ("register_signer", Box::new(|w| w.register_signer(SIGNER.into()))),
        ("revoke_signer", Box::new(|w| w.revoke_signer(SIGNER.into()))),
        ("allow_receiver", Box::new(|w| w.allow_receiver(USDC.parse().unwrap()))),
        ("disallow_receiver", Box::new(|w| w.disallow_receiver(USDC.parse().unwrap()))),
        ("set_token", Box::new(|w| w.set_token(USDC.parse().unwrap(), usdc(1, 1)))),
        ("set_near_caps", Box::new(|w| w.set_near_caps(caps(1, 1)))),
        ("freeze", Box::new(|w| w.freeze())),
        ("unfreeze", Box::new(|w| w.unfreeze())),
        ("set_cross_chain", Box::new(|w| w.set_cross_chain(true))),
        ("allow_cross_chain_recipient", Box::new(|w| w.allow_cross_chain_recipient(BASE_RECIPIENT.into()))),
        ("disallow_cross_chain_recipient", Box::new(|w| w.disallow_cross_chain_recipient(BASE_RECIPIENT.into()))),
    ];
    for caller in [agent(), stranger()] {
        for (name, call) in &calls {
            let mut w = wallet();
            as_caller(caller.clone());
            let err = catch_unwind(AssertUnwindSafe(|| call(&mut w))).expect_err(&format!("{caller} ran {name}"));
            let msg = err.downcast_ref::<String>().cloned().unwrap_or_default();
            assert!(msg.contains("owner only"), "{name}: {msg}");
        }
    }
}

#[test]
fn malformed_owner_inputs_are_rejected() {
    let bad: Vec<(&str, Box<dyn Fn(&mut intented_wallet::Wallet)>)> = vec![
        ("short mandate hash", Box::new(|w| w.set_mandate("ab".repeat(31)))),
        ("uppercase mandate hash", Box::new(|w| w.set_mandate("AB".repeat(32)))),
        ("signer without 0x", Box::new(|w| w.register_signer(SIGNER[2..].into()))),
        ("short signer", Box::new(|w| w.register_signer(SIGNER[..41].into()))),
        ("non-hex signer", Box::new(|w| w.register_signer(format!("0x{}", "g".repeat(40))))),
        ("daily below per-tx", Box::new(|w| w.set_near_caps(caps(10, 9)))),
        ("token daily below per-tx", Box::new(|w| w.set_token(USDC.parse().unwrap(), usdc(10, 9)))),
        ("empty symbol", Box::new(|w| w.set_token(USDC.parse().unwrap(), Token { symbol: "".into(), ..usdc(1, 1) }))),
        ("symbol with a space", Box::new(|w| w.set_token(USDC.parse().unwrap(), Token { symbol: "US DC".into(), ..usdc(1, 1) }))),
        ("uppercase cross-chain recipient", Box::new(|w| w.allow_cross_chain_recipient(BASE_RECIPIENT.to_uppercase().replace("0X", "0x")))),
        ("short cross-chain recipient", Box::new(|w| w.allow_cross_chain_recipient(BASE_RECIPIENT[..41].into()))),
        ("decimals above 38", Box::new(|w| w.set_token(USDC.parse().unwrap(), Token { decimals: 39, ..usdc(1, 1) }))),
    ];
    for (name, call) in &bad {
        let mut w = wallet();
        assert!(catch_unwind(AssertUnwindSafe(|| call(&mut w))).is_err(), "accepted {name}");
    }
}

#[test]
fn cross_chain_payments_start_switched_off() {
    let c = wallet().get_config();
    assert!(!c.cross_chain_enabled);
    assert!(c.cross_chain_recipients.is_empty());
}
