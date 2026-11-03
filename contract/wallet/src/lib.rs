//! The Intented wallet contract.
//!
//! The agent proposes an action; the contract executes it only with a
//! TEE-signed `ALLOW` verdict for exactly that action, within its own caps.
//! Decisions: docs/decisions/2026-11-01-wallet-caps-window-allowlist.md.

mod judged;

use near_sdk::json_types::{Base64VecU8, U128, U64};
use near_sdk::store::{IterableSet, LookupMap, LookupSet};
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};

/// Gas for the proposed call and for the callback that records its outcome.
const CALL_GAS: Gas = Gas::from_tgas(50);
const CALLBACK_GAS: Gas = Gas::from_tgas(10);

const DAY_MS: u64 = 86_400_000;

/// Token methods whose `amount` argument counts against that token's caps.
const TOKEN_TRANSFER_METHODS: [&str; 2] = ["ft_transfer", "ft_transfer_call"];

/// What a cap limits: the attached NEAR deposit, or one token.
#[near(serializers = [borsh])]
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
enum Asset {
    Near,
    Token(AccountId),
}

/// Spent so far on one UTC day (`day` = block_timestamp_ms / DAY_MS).
#[near(serializers = [borsh])]
#[derive(Clone)]
struct DaySpend {
    day: u64,
    amount: u128,
}

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
    /// Proposed, not yet executed.
    Pending,
    /// The verdict checked out and the call was sent.
    Allowed,
    /// The call succeeded.
    Executed,
    /// The call failed.
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

/// A token the wallet may transfer: its symbol and decimals, which must match
/// the firewall core's token table, and its caps in the smallest unit.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Token {
    pub symbol: String,
    pub decimals: u8,
    pub caps: Caps,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner_id: AccountId,
    pub agent_id: AccountId,
    pub model_id: String,
    pub frozen: bool,
    pub mandate_hash: Option<String>,
    pub prompt_hash: Option<String>,
    pub signers: Vec<String>,
    pub receivers: Vec<AccountId>,
    pub near_caps: Caps,
    pub cross_chain_enabled: bool,
    pub cross_chain_recipients: Vec<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Wallet {
    owner_id: AccountId,
    agent_id: AccountId,
    /// The NEAR AI model id; it prefixes the signed text and must be the request's model.
    model_id: String,
    frozen: bool,
    mandate_hash: Option<String>,
    /// sha256 of the firewall core's system prompt for this network.
    prompt_hash: Option<String>,
    /// Allowlisted TEE signers, lowercase `0x` Ethereum addresses.
    signers: IterableSet<String>,
    /// Contracts the agent may call.
    receivers: IterableSet<AccountId>,
    /// Token contracts the wallet may transfer from, with caps. A token transfer
    /// on any other contract is rejected.
    tokens: LookupMap<AccountId, Token>,
    /// Caps on the attached NEAR deposit, in yoctoNEAR. Zero until the owner sets them.
    near_caps: Caps,
    proposals: LookupMap<u64, Proposal>,
    next_proposal_id: u64,
    used_nonces: LookupSet<u64>,
    spent: LookupMap<Asset, DaySpend>,
    /// The owner's switch for payments through 1Click; off by default.
    cross_chain_enabled: bool,
    /// If not empty, the only destination-chain recipients allowed (lowercase 0x + 40 hex).
    cross_chain_recipients: IterableSet<String>,
}

#[near]
impl Wallet {
    #[init]
    pub fn new(owner_id: AccountId, agent_id: AccountId, model_id: String) -> Self {
        Self {
            owner_id,
            agent_id,
            model_id,
            frozen: false,
            mandate_hash: None,
            prompt_hash: None,
            signers: IterableSet::new(b"s"),
            receivers: IterableSet::new(b"r"),
            tokens: LookupMap::new(b"t"),
            near_caps: Caps { per_tx: U128(0), daily: U128(0) },
            proposals: LookupMap::new(b"p"),
            next_proposal_id: 0,
            used_nonces: LookupSet::new(b"n"),
            spent: LookupMap::new(b"d"),
            cross_chain_enabled: false,
            cross_chain_recipients: IterableSet::new(b"x"),
        }
    }

    // Owner methods

    /// `text_hash` is the lowercase hex sha256 of the mandate text.
    pub fn set_mandate(&mut self, text_hash: String) {
        self.assert_owner();
        require!(is_lower_hex(&text_hash, 64), "text_hash must be 64 lowercase hex characters");
        self.mandate_hash = Some(text_hash);
    }

    /// `text_hash` is the lowercase hex sha256 of the firewall core's system prompt.
    pub fn set_prompt_hash(&mut self, text_hash: String) {
        self.assert_owner();
        require!(is_lower_hex(&text_hash, 64), "text_hash must be 64 lowercase hex characters");
        self.prompt_hash = Some(text_hash);
    }

    pub fn set_model_id(&mut self, model_id: String) {
        self.assert_owner();
        require!(!model_id.is_empty() && !model_id.contains(':'), "model_id must be non-empty with no ':'");
        self.model_id = model_id;
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

    pub fn set_token(&mut self, token_id: AccountId, token: Token) {
        self.assert_owner();
        assert_caps(&token.caps);
        require!(
            !token.symbol.is_empty() && token.symbol.bytes().all(|b| b.is_ascii_graphic()),
            "symbol must be non-empty printable ASCII with no spaces"
        );
        require!(token.decimals <= 38, "decimals must be at most 38");
        self.tokens.insert(token_id, token);
    }

    pub fn set_near_caps(&mut self, caps: Caps) {
        self.assert_owner();
        assert_caps(&caps);
        self.near_caps = caps;
    }

    pub fn set_cross_chain(&mut self, enabled: bool) {
        self.assert_owner();
        self.cross_chain_enabled = enabled;
    }

    pub fn allow_cross_chain_recipient(&mut self, address: String) {
        self.assert_owner();
        require!(is_evm_address(&address), "address must be lowercase 0x plus 40 hex characters");
        self.cross_chain_recipients.insert(address);
    }

    pub fn disallow_cross_chain_recipient(&mut self, address: String) {
        self.assert_owner();
        self.cross_chain_recipients.remove(&address);
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

    /// Execute a proposal with a NEAR AI verdict: `req_bytes` and `resp_bytes`
    /// exactly as sent and received, and the 65-byte signature over them.
    pub fn execute(&mut self, proposal_id: u64, req_bytes: Base64VecU8, resp_bytes: Base64VecU8, sig_65: String) -> Promise {
        require!(env::predecessor_account_id() == self.agent_id, "agent only");
        let mut proposal = self.proposals.get(&proposal_id).cloned().unwrap_or_else(|| env::panic_str("no such proposal"));
        require!(proposal.status == ProposalStatus::Pending, "proposal is not pending");
        require!(!self.frozen, "wallet is frozen");
        let action = proposal.action.clone();
        require!(self.receivers.contains(&action.receiver_id), "receiver is not allowlisted");
        require!(!self.used_nonces.contains(&action.nonce.0), "nonce already used");
        require!(env::block_timestamp_ms() <= action.expiry_ms.0, "action has expired");

        let canonical = String::from_utf8(proposal.action.canonical_bytes()).unwrap();
        let mandate_hash = self.mandate_hash.as_deref().unwrap_or_else(|| env::panic_str("mandate not set"));
        let prompt_hash = self.prompt_hash.as_deref().unwrap_or_else(|| env::panic_str("prompt hash not set"));
        let shown_amount = TOKEN_TRANSFER_METHODS.contains(&action.method.as_str()).then(|| {
            let token = self.token_for(&action.receiver_id);
            format_amount(token_amount(&proposal.args_json), token.decimals, &token.symbol)
        });
        let cross_chain = judged::check_request(
            &req_bytes.0,
            &judged::Expected {
                model_id: &self.model_id,
                prompt_hash,
                mandate_hash,
                canonical_action: &canonical,
                args_json: &proposal.args_json,
                amount: shown_amount.as_deref(),
            },
        );
        if let Some(cc) = &cross_chain {
            self.check_cross_chain(cc, &action, &proposal.args_json);
        }
        judged::check_verdict(&resp_bytes.0, &canonical);

        let signed_text = format!(
            "{}:{}:{}",
            self.model_id,
            hex::encode(env::sha256(&req_bytes.0)),
            hex::encode(env::sha256(&resp_bytes.0))
        );
        let signer = recover_eth_address(signed_text.as_bytes(), &sig_65).unwrap_or_else(|| env::panic_str("bad signature"));
        require!(self.signers.contains(&signer), "signer is not allowlisted");

        self.charge(Asset::Near, action.deposit.0, &self.near_caps.clone());
        if TOKEN_TRANSFER_METHODS.contains(&action.method.as_str()) {
            let token = self.token_for(&action.receiver_id);
            self.charge(Asset::Token(action.receiver_id.clone()), token_amount(&proposal.args_json), &token.caps);
        }

        self.used_nonces.insert(action.nonce.0);
        proposal.status = ProposalStatus::Allowed;
        let args = proposal.args_json.clone().into_bytes();
        self.proposals.insert(proposal_id, proposal);

        Promise::new(action.receiver_id)
            .function_call(action.method, args, NearToken::from_yoctonear(action.deposit.0), CALL_GAS)
            .then(Promise::new(env::current_account_id()).function_call(
                "on_executed",
                near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({ "proposal_id": proposal_id })).unwrap(),
                NearToken::from_yoctonear(0),
                CALLBACK_GAS,
            ))
    }

    /// Records whether the proposed call succeeded.
    #[private]
    pub fn on_executed(&mut self, proposal_id: u64) {
        if let Some(p) = self.proposals.get_mut(&proposal_id) {
            p.status = if near_sdk::is_promise_success() { ProposalStatus::Executed } else { ProposalStatus::Failed };
        }
    }

    // Views

    pub fn get_proposal(&self, proposal_id: u64) -> Option<Proposal> {
        self.proposals.get(&proposal_id).cloned()
    }

    pub fn get_config(&self) -> Config {
        Config {
            owner_id: self.owner_id.clone(),
            agent_id: self.agent_id.clone(),
            model_id: self.model_id.clone(),
            frozen: self.frozen,
            mandate_hash: self.mandate_hash.clone(),
            prompt_hash: self.prompt_hash.clone(),
            signers: self.signers.iter().cloned().collect(),
            receivers: self.receivers.iter().cloned().collect(),
            near_caps: self.near_caps.clone(),
            cross_chain_enabled: self.cross_chain_enabled,
            cross_chain_recipients: self.cross_chain_recipients.iter().cloned().collect(),
        }
    }

    pub fn get_token(&self, token_id: AccountId) -> Option<Token> {
        self.tokens.get(&token_id).cloned()
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen
    }
}

/// The stored state before the cross-chain fields (deployed 1–3 November), so
/// `migrate` can upgrade a live wallet in place. Field order is the storage layout.
#[near(serializers = [borsh])]
struct WalletV1 {
    owner_id: AccountId,
    agent_id: AccountId,
    model_id: String,
    frozen: bool,
    mandate_hash: Option<String>,
    prompt_hash: Option<String>,
    signers: IterableSet<String>,
    receivers: IterableSet<AccountId>,
    tokens: LookupMap<AccountId, Token>,
    near_caps: Caps,
    proposals: LookupMap<u64, Proposal>,
    next_proposal_id: u64,
    used_nonces: LookupSet<u64>,
    spent: LookupMap<Asset, DaySpend>,
}

#[near]
impl Wallet {
    /// One-time upgrade of a wallet deployed before the cross-chain fields:
    /// keeps everything, adds the switch (off) and an empty recipient list.
    /// Callable only by the wallet account itself, i.e. in its own deploy.
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        let old: WalletV1 = env::state_read().unwrap_or_else(|| env::panic_str("no state to migrate"));
        Self {
            owner_id: old.owner_id,
            agent_id: old.agent_id,
            model_id: old.model_id,
            frozen: old.frozen,
            mandate_hash: old.mandate_hash,
            prompt_hash: old.prompt_hash,
            signers: old.signers,
            receivers: old.receivers,
            tokens: old.tokens,
            near_caps: old.near_caps,
            proposals: old.proposals,
            next_proposal_id: old.next_proposal_id,
            used_nonces: old.used_nonces,
            spent: old.spent,
            cross_chain_enabled: false,
            cross_chain_recipients: IterableSet::new(b"x"),
        }
    }
}

#[cfg(test)]
mod migrate_tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    #[test]
    fn migrate_keeps_a_v1_wallets_state_and_adds_cross_chain_switched_off() {
        let me: AccountId = "wallet.testnet".parse().unwrap();
        testing_env!(VMContextBuilder::new().current_account_id(me.clone()).predecessor_account_id(me).build());
        let mut signers = IterableSet::new(b"s");
        signers.insert("0x".to_string() + &"ab".repeat(20));
        let mut proposals = LookupMap::new(b"p");
        proposals.insert(4u64, Proposal {
            action: Action { receiver_id: "wrap.testnet".parse().unwrap(), method: "ft_transfer".into(), args_sha256: "a".repeat(64), deposit: U128(1), nonce: U64(9), expiry_ms: U64(1) },
            args_json: "{}".into(),
            status: ProposalStatus::Executed,
        });
        let mut v1 = WalletV1 {
            owner_id: "owner.testnet".parse().unwrap(),
            agent_id: "agent.testnet".parse().unwrap(),
            model_id: "Qwen/Qwen3.8-27B".into(),
            frozen: true,
            mandate_hash: Some("c".repeat(64)),
            prompt_hash: Some("d".repeat(64)),
            signers,
            receivers: IterableSet::new(b"r"),
            tokens: LookupMap::new(b"t"),
            near_caps: Caps { per_tx: U128(1), daily: U128(100) },
            proposals,
            next_proposal_id: 5,
            used_nonces: LookupSet::new(b"n"),
            spent: LookupMap::new(b"d"),
        };
        v1.signers.flush();
        v1.proposals.flush();
        env::state_write(&v1);

        let w = Wallet::migrate();
        let c = w.get_config();
        assert_eq!((c.model_id.as_str(), c.frozen, c.signers.len()), ("Qwen/Qwen3.8-27B", true, 1));
        assert_eq!(c.mandate_hash, Some("c".repeat(64)));
        assert!(!c.cross_chain_enabled && c.cross_chain_recipients.is_empty());
        assert_eq!(w.get_proposal(4).unwrap().status, ProposalStatus::Executed);
        assert_eq!(w.next_proposal_id, 5);
    }
}

impl Wallet {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
    }

    /// The cross-chain conditions of execute check 6 (interface spec).
    fn check_cross_chain(&self, cc: &judged::CrossChain, action: &Action, args_json: &str) {
        require!(self.cross_chain_enabled, "cross-chain payments are off");
        require!(action.method == "ft_transfer", "a cross-chain payment must be an ft_transfer");
        let args: near_sdk::serde_json::Value =
            near_sdk::serde_json::from_str(args_json).unwrap_or_else(|_| env::panic_str("args are not JSON"));
        require!(
            args.get("receiver_id").and_then(|v| v.as_str()) == Some(cc.deposit_address.as_str()),
            "cross_chain.deposit_address must equal args.receiver_id"
        );
        require!(is_evm_address(&cc.recipient), "cross_chain.recipient must be lowercase 0x plus 40 hex characters");
        let canonical_u64 = !cc.deadline_ms.is_empty()
            && cc.deadline_ms.bytes().all(|b| b.is_ascii_digit())
            && (cc.deadline_ms == "0" || !cc.deadline_ms.starts_with('0'));
        let deadline: u64 = canonical_u64
            .then(|| cc.deadline_ms.parse().ok())
            .flatten()
            .unwrap_or_else(|| env::panic_str("cross_chain.deadline_ms must be a u64 decimal string"));
        require!(action.expiry_ms.0 < deadline, "the action's expiry_ms must be earlier than cross_chain.deadline_ms");
        require!(
            self.cross_chain_recipients.is_empty() || self.cross_chain_recipients.contains(&cc.recipient),
            "recipient is not on the cross-chain recipient list"
        );
    }

    fn token_for(&self, token_id: &AccountId) -> Token {
        self.tokens.get(token_id).cloned().unwrap_or_else(|| env::panic_str("no caps set for this token"))
    }

    /// Counts `amount` of `asset` against `caps` for today (UTC), or panics.
    fn charge(&mut self, asset: Asset, amount: u128, caps: &Caps) {
        require!(amount <= caps.per_tx.0, "over the per-transaction cap");
        let day = env::block_timestamp_ms() / DAY_MS;
        let spent_today = match self.spent.get(&asset) {
            Some(s) if s.day == day => s.amount,
            _ => 0,
        };
        let total = spent_today.checked_add(amount).unwrap_or_else(|| env::panic_str("over the daily cap"));
        require!(total <= caps.daily.0, "over the daily cap");
        self.spent.insert(asset, DaySpend { day, amount: total });
    }
}

/// The `amount` of a token transfer: a decimal string in the token's smallest unit.
fn token_amount(args_json: &str) -> u128 {
    let args: near_sdk::serde_json::Value =
        near_sdk::serde_json::from_str(args_json).unwrap_or_else(|_| env::panic_str("token transfer args are not JSON"));
    let amount = args.get("amount").unwrap_or_else(|| env::panic_str("token transfer args have no amount"));
    let s = amount.as_str().unwrap_or_else(|| env::panic_str("token transfer amount must be a decimal string"));
    require!(!s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()), "token transfer amount must be a decimal string");
    s.parse().unwrap_or_else(|_| env::panic_str("token transfer amount is over u128"))
}

/// EIP-191 personal_sign recovery (as in KT2): the lowercase `0x` address that
/// signed `message`, or `None` if the signature is malformed or does not recover.
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

/// A destination-chain address: lowercase 0x plus 40 hex characters.
fn is_evm_address(s: &str) -> bool {
    s.strip_prefix("0x").is_some_and(|hex| is_lower_hex(hex, 40))
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

/// A token amount in whole tokens, as the firewall core shows it to the model:
/// (10^21, 24, "wNEAR") -> "0.001 wNEAR". No rounding, trailing zeros trimmed.
pub fn format_amount(raw: u128, decimals: u8, symbol: &str) -> String {
    let d = decimals as usize;
    let digits = format!("{raw:0>width$}", width = d + 1);
    let (whole, fraction) = digits.split_at(digits.len() - d);
    let fraction = fraction.trim_end_matches('0');
    if fraction.is_empty() {
        format!("{whole} {symbol}")
    } else {
        format!("{whole}.{fraction} {symbol}")
    }
}
