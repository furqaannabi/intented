//! The Intented wallet contract.
//!
//! The agent proposes an action; the contract executes it only with a
//! TEE-signed `ALLOW` verdict for exactly that action, within its own caps.
//! Decisions: docs/decisions/2026-11-01-wallet-caps-window-allowlist.md.

use near_sdk::json_types::{U128, U64};
use near_sdk::store::{IterableSet, LookupMap};
use near_sdk::{env, near, require, AccountId, PanicOnDefault};

/// A per-transaction and a daily limit, in the asset's smallest unit.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Caps {
    pub per_tx: U128,
    pub daily: U128,
}

/// One thing the agent wants the wallet to do (interface spec, "Canonical action").
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Action {
    pub receiver_id: AccountId,
    pub method: String,
    pub args_sha256: String,
    /// yoctoNEAR
    pub deposit: U128,
    pub nonce: U64,
    pub expiry_ms: U64,
}

impl Action {
    /// `INTENTED_V1|receiver_id|method|args_sha256|deposit|nonce|expiry_ms`,
    /// identical to the firewall core's encoder.
    pub fn canonical_bytes(&self) -> Vec<u8> {
        format!(
            "INTENTED_V1|{}|{}|{}|{}|{}|{}",
            self.receiver_id, self.method, self.args_sha256, self.deposit.0, self.nonce.0, self.expiry_ms.0
        )
        .into_bytes()
    }
}

#[near(serializers = [borsh, json])]
#[serde(rename_all = "lowercase")]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Executed,
    Failed,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub action: Action,
    /// The exact arguments `execute` will send; they hash to `action.args_sha256`.
    pub args_json: String,
    pub status: ProposalStatus,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner_id: AccountId,
    pub agent_id: AccountId,
    pub frozen: bool,
    pub mandate_hash: Option<String>,
    pub signers: Vec<String>,
    pub receivers: Vec<AccountId>,
    pub near_caps: Caps,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Wallet {
    owner_id: AccountId,
    agent_id: AccountId,
    frozen: bool,
    mandate_hash: Option<String>,
    /// Allowlisted TEE signers, lowercase `0x` Ethereum addresses.
    signers: IterableSet<String>,
    /// Contracts the agent may call.
    receivers: IterableSet<AccountId>,
    /// Caps per token contract. A token transfer on a contract without caps is rejected.
    token_caps: LookupMap<AccountId, Caps>,
    /// Caps on the attached NEAR deposit, in yoctoNEAR. Zero until the owner sets them.
    near_caps: Caps,
    proposals: LookupMap<u64, Proposal>,
    next_proposal_id: u64,
}

#[near]
impl Wallet {
    #[init]
    pub fn new(owner_id: AccountId, agent_id: AccountId) -> Self {
        Self {
            owner_id,
            agent_id,
            frozen: false,
            mandate_hash: None,
            signers: IterableSet::new(b"s"),
            receivers: IterableSet::new(b"r"),
            token_caps: LookupMap::new(b"t"),
            near_caps: Caps { per_tx: U128(0), daily: U128(0) },
            proposals: LookupMap::new(b"p"),
            next_proposal_id: 0,
        }
    }

    // Owner methods

    /// `text_hash` is the lowercase hex sha256 of the mandate text.
    pub fn set_mandate(&mut self, text_hash: String) {
        self.assert_owner();
        require!(is_lower_hex(&text_hash, 64), "text_hash must be 64 lowercase hex characters");
        self.mandate_hash = Some(text_hash);
    }

    pub fn register_signer(&mut self, eth_address: String) {
        self.assert_owner();
        self.signers.insert(normalize_eth_address(&eth_address));
    }

    pub fn revoke_signer(&mut self, eth_address: String) {
        self.assert_owner();
        self.signers.remove(&normalize_eth_address(&eth_address));
    }

    pub fn allow_receiver(&mut self, receiver_id: AccountId) {
        self.assert_owner();
        self.receivers.insert(receiver_id);
    }

    pub fn disallow_receiver(&mut self, receiver_id: AccountId) {
        self.assert_owner();
        self.receivers.remove(&receiver_id);
    }

    pub fn set_token_caps(&mut self, token_id: AccountId, caps: Caps) {
        self.assert_owner();
        assert_caps(&caps);
        self.token_caps.insert(token_id, caps);
    }

    pub fn set_near_caps(&mut self, caps: Caps) {
        self.assert_owner();
        assert_caps(&caps);
        self.near_caps = caps;
    }

    pub fn freeze(&mut self) {
        self.assert_owner();
        self.frozen = true;
    }

    pub fn unfreeze(&mut self) {
        self.assert_owner();
        self.frozen = false;
    }

    // Agent methods

    /// Store an action for judging. Returns its proposal id.
    pub fn propose(&mut self, action: Action, args_json: String) -> u64 {
        require!(env::predecessor_account_id() == self.agent_id, "agent only");
        require!(is_identifier(&action.method), "method must be an identifier");
        require!(
            hex::encode(env::sha256(args_json.as_bytes())) == action.args_sha256,
            "args_json does not hash to args_sha256"
        );
        let id = self.next_proposal_id;
        self.next_proposal_id += 1;
        self.proposals.insert(id, Proposal { action, args_json, status: ProposalStatus::Pending });
        id
    }

    // Views

    pub fn get_proposal(&self, proposal_id: u64) -> Option<Proposal> {
        self.proposals.get(&proposal_id).cloned()
    }

    pub fn get_config(&self) -> Config {
        Config {
            owner_id: self.owner_id.clone(),
            agent_id: self.agent_id.clone(),
            frozen: self.frozen,
            mandate_hash: self.mandate_hash.clone(),
            signers: self.signers.iter().cloned().collect(),
            receivers: self.receivers.iter().cloned().collect(),
            near_caps: self.near_caps.clone(),
        }
    }

    pub fn get_token_caps(&self, token_id: AccountId) -> Option<Caps> {
        self.token_caps.get(&token_id).cloned()
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen
    }
}

impl Wallet {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
    }
}

fn is_lower_hex(s: &str, len: usize) -> bool {
    s.len() == len && s.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// `[A-Za-z_][A-Za-z0-9_]*`, the firewall core's rule, so `|` can never appear.
fn is_identifier(s: &str) -> bool {
    let mut bytes = s.bytes();
    matches!(bytes.next(), Some(b'A'..=b'Z' | b'a'..=b'z' | b'_'))
        && bytes.all(|b| matches!(b, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'_'))
}

fn normalize_eth_address(addr: &str) -> String {
    let lower = addr.to_ascii_lowercase();
    let ok = lower.strip_prefix("0x").is_some_and(|hex| is_lower_hex(hex, 40));
    require!(ok, "eth_address must be 0x followed by 40 hex characters");
    lower
}

fn assert_caps(caps: &Caps) {
    require!(caps.daily.0 >= caps.per_tx.0, "daily cap must be at least the per-transaction cap");
}
