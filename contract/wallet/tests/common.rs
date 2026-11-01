#![allow(dead_code)]
use intented_wallet::Wallet;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId};

pub fn owner() -> AccountId { "owner.testnet".parse().unwrap() }
pub fn agent() -> AccountId { "agent.testnet".parse().unwrap() }
pub fn stranger() -> AccountId { "stranger.testnet".parse().unwrap() }

/// Make `who` the caller of the next contract call.
pub fn as_caller(who: AccountId) {
    testing_env!(VMContextBuilder::new().predecessor_account_id(who).build());
}

pub const MODEL: &str = "z-ai/glm-5.3-flash";

pub fn wallet() -> Wallet {
    as_caller(owner());
    Wallet::new(owner(), agent(), MODEL.into())
}

use intented_wallet::Action;
use near_sdk::json_types::{U128, U64};

pub const USDC: &str = "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af";

pub fn sha256_hex(b: &[u8]) -> String {
    hex::encode(near_sdk::env::sha256(b))
}

/// A 1 USDC ft_transfer to vendor.testnet, and its exact args.
pub fn usdc_payment(amount: u128, nonce: u64) -> (Action, String) {
    let args = format!(r#"{{"receiver_id":"vendor.testnet","amount":"{amount}"}}"#);
    let action = Action {
        receiver_id: USDC.parse().unwrap(),
        method: "ft_transfer".into(),
        args_sha256: sha256_hex(args.as_bytes()),
        deposit: U128(1),
        nonce: U64(nonce),
        expiry_ms: U64(u64::MAX),
    };
    (action, args)
}
