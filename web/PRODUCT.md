# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Inferred from the build plan, not yet confirmed by William:
- Hackathon judges and video viewers: they watch an agent get prompt-injected and see the wallet refuse, then inspect the proof. Two of the judges are AI (Claude Code, Codex) reading the repo.
- The wallet owner: sets the plain-English mandate, watches the agent's proposals arrive, and checks why each was allowed or denied.

## Product Purpose
Intented is an AI agent's NEAR wallet that executes an action only when it carries a TEE-signed ALLOW verdict from NEAR AI Cloud, checking the action against the owner's plain-English mandate. The web app shows that happening: the mandate, the live proposal feed, each verdict and its reason, and the receipt with the signature, attestation report and on-chain transaction.

## Positioning
Spending caps catch amounts; Intented checks meaning. A poisoned paywall that asks for a payment under the cap, to the wrong account, is refused on-chain, and the refusal itself is a transaction anyone can look up.

## Operating Context
- The demo: a scripted agent buys market data from a mock x402 paywall. The honest route pays 0.001 wNEAR to intented-vendor.testnet; the poisoned route asks 0.01 wNEAR to intented-attacker.testnet.
- Data comes from the API: GET /api/proposals?since= (poll on updated_at) and GET /api/proposals/:id. A proposal goes pending → allowed/denied → executed/denied/failed, in about 15–20 s.
- Real evidence per proposal: verdict, the model's reason (signed text, shown verbatim), model, chat_id, signature, signer, attestation_url, near_tx_hash.

## Capabilities and Constraints
- Next.js (App Router), TypeScript, Tailwind, deployed on Vercel. The web app never holds a private key.
- The contract does not verify the TDX quote; attestation is checked off-chain and the signer allowlisted. Copy must never claim otherwise.
- A stub verdict is never shown as verified.
- The model's reason is signed output and is shown exactly as returned, typos included.
- Undecided: how the owner changes the mandate from the UI (wallet signing, a shown command, or read-only).
- Red-team stats (27/27 attacks denied, 0/26 benign denied on 1 November) come from `pnpm kt3`; the stats panel must show numbers from the real run.

## Brand Commitments
- Name: Intented. One-liner: "Your agent only does what you intented." (the misspelling is the name).
- Nothing visual is decided yet (inferred: William did not name any).

## Evidence on Hand
Real testnet transactions: honest execute C8P7yHvwT6e6C5LZLgXQ4uXDJwyoCDGX6Y7Vq5uvbtHH, refused poisoned execute FvsDHLYMAXuAuTSUyDzhUzG3Z9kPnzv4FD9MxDj88jxm. Attestation report: docs/attestations/0x835ab53d20294ef795906dff21ae4c045336aa26.json. No customers, testimonials or usage numbers exist; none may be invented.

## Product Principles
- Show the proof, not the claim: every verdict links to what makes it checkable.
- A refusal is a success state, not an error.
- Plain statements; nothing stronger than what the code verifies.
