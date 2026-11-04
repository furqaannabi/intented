//! Bounded proposal storage: a leaked agent key can't lock the wallet's NEAR.
//! At most 32 pending proposals, expiry at most an hour ahead, and prune frees
//! finished or expired ones (anyone) or any pending one (the owner).

mod common;
use common::*;
use intented_wallet::{Action, Wallet};
use near_sdk::json_types::U64;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId};
use std::panic::{catch_unwind, AssertUnwindSafe};

const HOUR_MS: u64 = 3_600_000;

fn at(who: AccountId, ms: u64) {
    testing_env!(VMContextBuilder::new().predecessor_account_id(who).block_timestamp(ms * 1_000_000).build());
}

fn payment(nonce: u64, expiry_ms: u64) -> (Action, String) {
    let (a, args) = usdc_payment(1_000_000, nonce);
    (Action { expiry_ms: U64(expiry_ms), ..a }, args)
}

fn propose(w: &mut Wallet, nonce: u64, expiry_ms: u64) -> Result<u64, String> {
    let (a, args) = payment(nonce, expiry_ms);
    as_caller(agent());
    catch_unwind(AssertUnwindSafe(|| w.propose(a, args))).map_err(|e| e.downcast_ref::<String>().cloned().unwrap_or_default())
}

#[test]
fn propose_refuses_an_expiry_more_than_an_hour_ahead() {
    let mut w = wallet();
    propose(&mut w, 1, NOW_MS + HOUR_MS).expect("an hour ahead is allowed");
    let err = propose(&mut w, 2, NOW_MS + HOUR_MS + 1).expect_err("more than an hour ahead");
    assert!(err.contains("hour"), "{err}");
}

#[test]
fn at_most_32_proposals_can_be_pending() {
    let mut w = wallet();
    for n in 0..32 {
        propose(&mut w, n, NOW_MS + HOUR_MS).unwrap_or_else(|e| panic!("proposal {n}: {e}"));
    }
    let err = propose(&mut w, 99, NOW_MS + HOUR_MS).expect_err("a 33rd pending proposal");
    assert!(err.contains("pending"), "{err}");
}

#[test]
fn anyone_prunes_expired_proposals_which_frees_their_slots() {
    let mut w = wallet();
    let ids: Vec<u64> = (0..32).map(|n| propose(&mut w, n, NOW_MS + HOUR_MS).unwrap()).collect();
    at(stranger(), NOW_MS + HOUR_MS);
    assert_eq!(w.prune(ids.clone()), 0, "not expired yet");
    at(stranger(), NOW_MS + HOUR_MS + 1);
    assert_eq!(w.prune(ids.clone()), 32);
    assert!(ids.iter().all(|id| w.get_proposal(*id).is_none()));
    at(agent(), NOW_MS + HOUR_MS + 1);
    let (a, args) = payment(100, NOW_MS + 2 * HOUR_MS);
    w.propose(a, args);
}

#[test]
fn only_the_owner_prunes_a_live_pending_proposal() {
    let mut w = wallet();
    let id = propose(&mut w, 1, NOW_MS + HOUR_MS).unwrap();
    for who in [agent(), stranger()] {
        at(who, NOW_MS);
        assert_eq!(w.prune(vec![id]), 0);
        assert!(w.get_proposal(id).is_some());
    }
    at(owner(), NOW_MS);
    assert_eq!(w.prune(vec![id]), 1);
    assert!(w.get_proposal(id).is_none());
}

#[test]
fn prune_takes_at_most_64_ids_and_skips_unknown_ones() {
    let mut w = wallet();
    at(owner(), NOW_MS);
    assert_eq!(w.prune(vec![7, 8, 9]), 0);
    assert!(catch_unwind(AssertUnwindSafe(|| w.prune((0..65).collect()))).is_err());
}
