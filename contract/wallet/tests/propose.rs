mod common;
use common::*;
use intented_wallet::ProposalStatus;

#[test]
fn agent_proposes_an_action_and_it_is_stored_pending() {
    let mut w = wallet();
    let (action, args) = usdc_payment(1_000_000, 1);
    as_caller(agent());
    let id = w.propose(action.clone(), args.clone());
    let p = w.get_proposal(id).expect("stored");
    assert_eq!(p.action, action);
    assert_eq!(p.args_json, args);
    assert_eq!(p.status, ProposalStatus::Pending);
    assert_ne!(w.propose(action, args), id, "each proposal gets its own id");
}

use intented_wallet::{Action, Wallet};
use std::panic::{catch_unwind, AssertUnwindSafe};

fn rejects(caller: near_sdk::AccountId, action: Action, args: String, why: &str) {
    let mut w: Wallet = wallet();
    as_caller(caller);
    let err = catch_unwind(AssertUnwindSafe(|| w.propose(action, args))).expect_err(&format!("accepted: {why}"));
    let msg = err.downcast_ref::<String>().cloned().unwrap_or_default();
    assert!(msg.contains(why), "expected '{why}', got '{msg}'");
}

#[test]
fn only_the_agent_may_propose() {
    let (a, args) = usdc_payment(1_000_000, 1);
    rejects(owner(), a.clone(), args.clone(), "agent only");
    rejects(stranger(), a, args, "agent only");
}

#[test]
fn args_must_hash_to_args_sha256() {
    let (a, _) = usdc_payment(1_000_000, 1);
    let (_, other_args) = usdc_payment(10_000_000, 1);
    rejects(agent(), a.clone(), other_args, "args_sha256");
    rejects(agent(), Action { args_sha256: a.args_sha256.to_uppercase(), ..a.clone() }, String::new(), "args_sha256");
}

#[test]
fn fields_that_would_make_the_canonical_bytes_ambiguous_are_rejected() {
    let (a, args) = usdc_payment(1_000_000, 1);
    for method in ["", "ft|transfer", "1go", "ft transfer", "ft_trаnsfer"] {
        rejects(agent(), Action { method: method.into(), ..a.clone() }, args.clone(), "method");
    }
}

#[test]
fn oversized_args_or_method_are_rejected_so_an_agent_cannot_lock_the_wallets_near_in_storage() {
    let (a, _) = usdc_payment(1_000_000, 1);
    let at_limit = format!(r#"{{"receiver_id":"vendor.testnet","amount":"1","memo":"{}"}}"#, "m".repeat(2048 - 55));
    assert_eq!(at_limit.len(), 2048);
    let mut w = wallet();
    as_caller(agent());
    w.propose(Action { args_sha256: sha256_hex(at_limit.as_bytes()), ..a.clone() }, at_limit.clone());

    let over = format!("{at_limit} ");
    rejects(agent(), Action { args_sha256: sha256_hex(over.as_bytes()), ..a.clone() }, over, "args_json");
    rejects(agent(), Action { method: "m".repeat(65), ..a.clone() }, "{}".into(), "method");
}
