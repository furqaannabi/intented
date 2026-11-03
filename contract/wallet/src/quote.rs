//! 1Click's signed quote: the last seven conditions of execute check 6.
//!
//! 1Click signs, with ed25519, the UTF-8 bytes of base58(sha256(payload)),
//! where payload is the stable JSON of the quote fields it signs. Verifying it
//! ties the deposit address the wallet pays to the recipient, asset and amount
//! 1Click promised, so the deposit address is not the API's word.
//! Decisions: docs/decisions/2026-11-03-execute-verifies-the-1click-quote.md,
//! docs/decisions/2026-11-03-accept-signed-1click-quote.md.

use near_sdk::serde::Deserialize;
use near_sdk::serde_json::{self, Value};
use near_sdk::{bs58, env, require, AccountId};

use crate::judged::CrossChain;

/// The signed fields execute reads. Others in the payload are covered by the
/// signature and not read; a duplicate of any field read here fails to parse.
#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", rename_all = "camelCase")]
struct SignedFields {
    dry: bool,
    swap_type: String,
    recipient_type: String,
    #[serde(default)]
    deposit_memo: Option<Value>,
    #[serde(default)]
    deposit_address: Option<String>,
    recipient: String,
    destination_asset: String,
    origin_asset: String,
    amount_in: String,
    refund_to: String,
    amount_out_formatted: String,
}

/// Decodes a stored or given "ed25519:<base58>" key or signature of `N` bytes.
pub fn ed25519_bytes<const N: usize>(s: &str) -> Option<[u8; N]> {
    let b58 = s.strip_prefix("ed25519:")?;
    bs58::decode(b58).into_vec().ok()?.try_into().ok()
}

/// Panics unless `cc.signed_quote` is 1Click's quote for exactly this payment.
/// `token` is the contract the wallet transfers from; `amount` is args.amount.
pub fn check_signed_quote(cc: &CrossChain, one_click_key: &[u8; 32], wallet: &AccountId, token: &AccountId, amount: &str) {
    let q = &cc.signed_quote;
    let signature: [u8; 64] = ed25519_bytes(&q.signature).unwrap_or_else(|| env::panic_str("1Click signature is not an ed25519 signature"));
    let message = bs58::encode(env::sha256(q.payload.as_bytes())).into_string();
    require!(env::ed25519_verify(&signature, message.as_bytes(), one_click_key), "1Click signature does not verify with the registered 1Click key");

    let f: SignedFields = serde_json::from_str(&q.payload)
        .unwrap_or_else(|err| env::panic_str(&format!("signed quote is not 1Click's quote fields: {err}")));
    require!(!f.dry, "signed quote is dry");
    require!(f.swap_type == "EXACT_OUTPUT", "signed quote swapType is not EXACT_OUTPUT");
    require!(f.recipient_type == "DESTINATION_CHAIN", "signed quote recipientType is not DESTINATION_CHAIN");
    require!(f.deposit_memo.is_none(), "signed quote has a depositMemo");
    require!(
        f.deposit_address.as_deref() == Some(cc.deposit_address.as_str()),
        "signed quote depositAddress is not cross_chain.deposit_address"
    );
    require!(f.recipient.to_lowercase() == cc.recipient, "signed quote recipient is not cross_chain.recipient");
    require!(f.destination_asset == cc.dest_asset, "signed quote destinationAsset is not cross_chain.dest_asset");
    require!(f.origin_asset == format!("nep141:{token}"), "signed quote originAsset is not the token being sent");
    require!(f.amount_in == amount, "signed quote amountIn is not args.amount");
    require!(f.refund_to == wallet.as_str(), "signed quote refundTo is not this wallet");
    require!(
        cc.amount_out.starts_with(&format!("{} ", f.amount_out_formatted)),
        "cross_chain.amount_out does not start with the signed quote's amountOutFormatted"
    );
}
