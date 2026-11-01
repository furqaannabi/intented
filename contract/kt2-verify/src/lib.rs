//! KT2: verify a NEAR AI Cloud response signature inside a NEAR contract.
//!
//! NEAR AI signs `{model_id}:{sha256_hex(request)}:{sha256_hex(response)}`
//! (`provider_tee`) or `{sha256_hex(request)}:{sha256_hex(response)}` (`gateway`)
//! with EIP-191 personal_sign. `verify` rebuilds that text from the raw bytes,
//! recovers the signer with `env::ecrecover` and checks it against an allowlist.
//!
//! Throwaway: the wallet contract's `execute` reuses this check on Day 3.

use near_sdk::json_types::Base64VecU8;
use near_sdk::store::IterableSet;
use near_sdk::{env, near, require, AccountId, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    /// Model id that prefixes the signed text; `None` for gateway signatures.
    model_id: Option<String>,
    /// Allowlisted signers, lowercase `0x`-prefixed Ethereum addresses.
    signers: IterableSet<String>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, model_id: Option<String>) -> Self {
        Self { owner_id, model_id, signers: IterableSet::new(b"s") }
    }

    pub fn register_signer(&mut self, eth_address: String) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
        self.signers.insert(eth_address.to_lowercase());
    }

    /// True only if `sig` (65 bytes, hex, optional `0x`) over the signed text
    /// rebuilt from `req` and `resp` recovers an allowlisted signer.
    pub fn verify(&self, req: Base64VecU8, resp: Base64VecU8, sig: String) -> bool {
        let hashes = format!("{}:{}", hex::encode(env::sha256(&req.0)), hex::encode(env::sha256(&resp.0)));
        let text = match &self.model_id {
            Some(model) => format!("{model}:{hashes}"),
            None => hashes,
        };
        match recover_eth_address(text.as_bytes(), &sig) {
            Some(address) => self.signers.contains(&address),
            None => false,
        }
    }
}

/// EIP-191 personal_sign recovery: the lowercase `0x` address that signed `message`,
/// or `None` if the signature is malformed or does not recover.
fn recover_eth_address(message: &[u8], sig_hex: &str) -> Option<String> {
    let sig = hex::decode(sig_hex.strip_prefix("0x").unwrap_or(sig_hex)).ok()?;
    if sig.len() != 65 {
        return None;
    }
    let v = match sig[64] {
        27 | 28 => sig[64] - 27,
        0 | 1 => sig[64],
        _ => return None,
    };
    let mut prefixed = format!("\x19Ethereum Signed Message:\n{}", message.len()).into_bytes();
    prefixed.extend_from_slice(message);
    let hash = env::keccak256(&prefixed);
    // malleability_flag = true rejects high-s signatures, as Ethereum does.
    let public_key = env::ecrecover(&hash, &sig[..64], v, true)?;
    Some(format!("0x{}", hex::encode(&env::keccak256(&public_key)[12..])))
}
