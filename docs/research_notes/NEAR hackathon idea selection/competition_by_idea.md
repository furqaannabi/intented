# Competition and novelty check for 10 NEAR hackathon ideas (as of Oct 22, 2026)

Context: the NEAR Hackathon runs Nov 1–14, 2026 (submissions close Nov 14, 23:59 UTC; judging Nov 16–18). It has 13 tracks, including Unstoppable DeFi, Investment Thesis, Privacy & Private AI, AI Security & Defense, Agent Economy, Real-World Money, Games With Real Economies, NFTs That Do Something, Social Money and Open Innovation. The prize pool is $250K, with $10K for first place in each track and a $55K grand prize. Each entry needs a public repo and a public demo post on X. Judges include Illia Polosukhin, a16z crypto, Dragonfly, Electric Capital, Kain Warwick (Synthetix/Infinex) and cyber•Fund, plus AI judges (Claude Code, Codex). — [nearhackathon.com](https://nearhackathon.com/); [Coinfomania](https://coinfomania.com/near-hackathon-launches-with-judging-panel-from-a16z/)

Note on dates: sources disagree on when Confidential Intents launched. One says Feb 25, 2026 ([LetsDataScience](https://letsdatascience.com/news/near-protocol-launches-confidential-intents-for-private-defi-1be8a6c7)), one says March 2026 ([LeoDex](https://leodex.io/editorial/near-confidential-intents-july-2026)), and NEAR announced general availability around July 2026, with a 13 Jul 2026 Aurora Swap API launch listed ([NEAR blog](https://www.near.org/blog/announcing-general-availability-of-confidential-intents); [TradingView/CoinMarketCal](https://www.tradingview.com/news/coinmarketcal:2e5a616a2094b:0-near-protocol-launches-confidential-intents-on-aurora-intents-swap-api-13-jul-2026/)). The most likely reading is a limited launch in early 2026 and general availability in July 2026.

## Q0. Which ideas come from Illia Polosukhin's Oct 3, 2026 post of 13 app ideas (high duplicate risk)?

### Takeaway
Six of the 10 ideas map directly onto Illia's Oct 3, 2026 list: Whisper OTC, Copy-Key, Never-Liq, Stake-to-Show, Factmarket and Pocket Pet. The hackathon has 13 tracks and he listed 13 ideas, he is a judge, and the post went out four weeks before kickoff. So many teams will probably build these. Sealed, Intent Firewall, Bidwire and Intents Ledger are not on his list, but each overlaps with an existing product or a public WIP repo.

### Cited Findings
- Illia's post went out on Oct 3, 2026 ([X post](https://x.com/ilblackdragon/status/2106269343881519444)). His 13 ideas were:
  1. AI Tamagochi (NFT characters that hold a NEAR balance to pay for inference, with feeding, dressing and later battle arenas)
  2. An AI encyclopedia whose facts are prediction markets, with AI writing pages from the markets' current assessments
  3. Private AI model testing against private datasets
  4. A universal checkout widget using NEAR Intents
  5. Event registration escrow (deposits held until check-in; attendees split the no-shows' funds)
  6. Private pull-request review
  7. Private medical second opinions
  8. Private transcription
  9. A private trading marketplace that solves counterparty discovery for the existing Intents "private deals" feature (OTC)
  10. Social trading by selling viewing keys to private transactions
  11. "Never get liquidated" management of lending and perps positions via Intents
  12. Delta-neutral positions
  13. A cap-table tool
  — [crypto.news, summarizing the post](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/); also [KuCoin flash](https://www.kucoin.com/news/flash/near-co-founder-outlines-application-development-directions-for-ai-cross-chain-payments-and-privacy-transactions), [Hokanews](https://www.hokanews.com/2026/10/near-co-founder-proposes-ai-pets.html)
- The AI encyclopedia idea explicitly cites Augur as its reference model — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
- KuCoin "insight" piece: "NEAR Intents could privately fill deals in an open OTC deal list ... lower the barrier for the less connected OTC traders". This appears to repeat Illia's idea #9 — [KuCoin insight](https://www.kucoin.com/news/insight/NEAR/6ac430a438a264000792bd1d)

Mapping:

| Our idea | Illia idea # | Likely track |
|---|---|---|
| 1 Sealed | not listed (closest is #2, encyclopedia + prediction markets) | Privacy & Private AI / Unstoppable DeFi |
| 2 Whisper OTC | #9 (almost verbatim) | Privacy / Unstoppable DeFi |
| 3 Copy-Key | #10 (verbatim) | Social Money / Privacy |
| 4 Never-Liq | #11 (verbatim) | Unstoppable DeFi |
| 5 Intent Firewall | not listed | AI Security & Defense |
| 6 Bidwire | not listed | Agent Economy |
| 7 Intents Ledger | not listed, but it is the Investment Thesis track's own brief | Investment Thesis |
| 8 Stake-to-Show | #5 (verbatim) | Real-World Money / Social Money |
| 9 Factmarket | #2 (verbatim) | Open Innovation |
| 10 Pocket Pet | #1 (verbatim) | NFTs That Do Something / Games |

### Inferences
- The 13 ideas match the 13 tracks in number, and Illia is a judge, so the post works as a de facto idea list for the hackathon. Expect several entries for each listed idea, especially the simple consumer ones (Pocket Pet, Stake-to-Show, Factmarket).
- Building a listed idea is not fatal, since judges may favour well-executed versions of their own asks. But differentiation then comes from execution depth, not novelty.

### Gaps
- I could not access the original X thread directly (I read it only through media summaries), so the exact wording, any track assignments in the thread, and its replies (e.g. people saying "building this") were not checked.

---

## Q1. Sealed: confidential cross-chain prediction market with a TEE-attested AI resolver

### Takeaway
On NEAR, the main prior art is NearMarket: an AI-first prediction market on Intents with public positions, which won first prize at a NEAR hacker house in Sept 2025. Private prediction markets already exist off-NEAR, mostly on Solana via Arcium, plus an Aztec Noir demo. LLM resolution is now standard practice in UMA/Polymarket pipelines. The remaining gap is the combination of hidden positions via Confidential Intents, cross-chain deposits, and a TEE-attested model publishing signed resolution receipts. I found no NEAR project doing all of these. **Duplicate risk: Medium.** Prediction markets are a popular hackathon category and Illia's encyclopedia idea will pull teams toward prediction-market primitives, but the confidential + attested-resolver angle is not on his list.

### Cited Findings
- **NearMarket** (on NEAR) is an "AI first prediction market" built as a live implementation of NEAR Intents. It has a Tinder/TikTok-style gamified UI, lets AI agents trade, and won first prize at the NEAR hackathon at Loops Hacker House on Sept 27, 2025 — [Medium, R. Agrawal](https://medium.com/@ravikantagrawal/nearmarket-an-ai-first-prediction-market-with-near-intent-implementation-2f0d7dff21f8). (The brief's claims that it uses Chainlink/Randa.mu oracles and public positions were not re-verified in this pass.) I found no public GitHub repo under that name related to the project; GitHub "nearmarket" hits are unrelated — [GitHub search, Oct 22 2026]
- **Aztec**: an open-source private prediction market in Noir stores bets as encrypted notes. On-chain state shows only total pool size, never who bet on which outcome or how much — [GitHub JohnGuilding/private-prediction-market-noir](https://github.com/JohnGuilding/private-prediction-market-noir)
- **Arcium (Solana)** has several live or announced projects: Melee Markets ("prediction market with encrypted resolution built to resist manipulation"), Epoch ("private betting"), Flew ("private betting + odds"), and Bench Markets and Pythia Markets (opportunity markets where only the creator sees positions) — [Eli5DeFi on X roster](https://x.com/Eli5defi/status/2064634433051963735)
- **AI/LLM resolution in production**: Risk Labs/UMA uses language models to draft proposals at about $0.005 per request, and OOTruthBot summarizes evidence. A Chainlink Labs DSPy single-LLM oracle reached 99.7% accuracy on sports but only 84–85% on politics/crypto. UMA settled 78% of markets during the 2026 World Cup — [track360 guide 2026](https://track360.io/blog/prediction-market-oracles-resolution-settlement-operator-guide-2026)
- Academic work: web-enabled LLMs agree with UMA final resolutions 89.58% of the time on disputed markets — [arXiv 2604.15674](https://arxiv.org/pdf/2604.15674). A multi-agent AI oracle design for prediction-market resolution — [arXiv 2605.30802](https://arxiv.org/html/2605.30802v1)
- UMA governance concerns: in most disputed Polymarket markets in May 2026, more than half of UMA votes came from the 10 largest wallets, and about 1 in 5 disputes had a voter with a stake in the market — [track360](https://track360.io/blog/prediction-market-oracles-resolution-settlement-operator-guide-2026)
- Confidential Intents run on a dedicated NEAR private shard (no public RPC, mempool or explorer) connected to mainnet by a TEE-secured bridge. Confidential TVL exceeds $160M — [NEAR blog GA](https://www.near.org/blog/announcing-general-availability-of-confidential-intents); [Coinfomania](https://coinfomania.com/near-hackathon-launches-with-judging-panel-from-a16z/)

### Inferences
- The UMA whale/conflict-of-interest data gives Sealed a concrete pitch: replace token-vote resolution with an attested model plus signed receipts.
- The novelty is the integration, not any single primitive. Judges who know Arcium's Solana roster may see "private prediction market" as already done elsewhere, so the pitch should lead with cross-chain + Confidential Intents + verifiable AI resolution.

### Gaps
- I could not confirm whether NearMarket is still live or maintained in 2026, or check its oracle design.
- I did not find other NEAR-native prediction markets launched in 2026 (searches returned nothing). This may be a true absence or a search limitation.
- I did not check Aleo- or Secret-based private prediction markets specifically; the search found none.

---

## Q2. Whisper OTC: open OTC deal board with size bands and private fills

### Takeaway
This is Illia's idea #9 almost word for word, and NEAR already ships the settlement half: peer-to-peer "private deals" on near.com. Off-NEAR, Renegade (MPC/ZK dark pool on Arbitrum/Base) is mature, and Arcium hosts Undesk (private P2P OTC). The only open gap is the discovery layer (the deal board and size bands) on top of NEAR's existing private-deal settlement. **Duplicate risk: High.**

### Cited Findings
- Illia's idea #9: a marketplace that fixes counterparty discovery for NEAR Intents' existing private deals feature — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
- near.com P2P: "negotiate directly with a counterparty for large or custom transactions without broadcasting to the market", with automatic on-chain settlement — [NEAR blog, near.com](https://www.near.org/blog/near-com) (via search snippet)
- KuCoin insight: "NEAR Intents could privately fill deals in an open OTC deal list ... keeping all Intents fills private" — [KuCoin](https://www.kucoin.com/news/insight/NEAR/6ac430a438a264000792bd1d)
- **Renegade**: an MPC + ZK dark pool live on Arbitrum and Base, settling at the Binance midpoint. It reports $336M all-time volume and $20M+ raised (Dragonfly, a hackathon judge's firm, led its $3.4M seed) — [renegade.fi](https://renegade.fi/); [The Block](https://www.theblock.co/post/213256/renegade-round-dragonfly-naval)
- **Undesk** (Arcium/Solana): "Private P2P OTC trading"; **Seedplex**: "sealed-bid, manipulation-proof Spot, OTC, and Perps venues" — [Eli5DeFi roster](https://x.com/Eli5defi/status/2064634433051963735)
- **Penumbra**: private DEX with selective disclosure — [penumbra.exchange](https://penumbra.exchange/)
- NEAR Business has a confidential treasury platform with private payments across 35 chains — [OneBullEx](https://onebullex.com/news/articles/near-business-launches-confidential-treasury-platform-with-private-payments-across-35-blockchains)

### Inferences
- Many teams will probably build a near.com P2P front end with a listing board. To stand out, Whisper OTC would need something structural: size-band commitments proven without revealing size (cf. the WIP "jurat" repo below, which proves a confidential balance meets a threshold), reputation, or solver/market-maker integration.
- Dragonfly (Renegade's backer) is a judge, so expect informed comparisons to dark pools.

### Gaps
- I did not inspect near.com's private-deal UX or whether a public deal board already exists in its UI.

---

## Q3. Copy-Key: sell time-limited viewing keys to private trades

### Takeaway
This is Illia's idea #10 verbatim. Infinex Confidential (built on NEAR Confidential Intents, July 2026) gives each user a confidential identity with a dedicated key, but I found no evidence that it sells or shares viewing keys. Zcash has mature viewing keys and a UFVK-based paid-file marketplace, but no "subscribe to a trader's private trades" product. A packaged product is a genuine gap; the concept is not. **Duplicate risk: High.**

### Cited Findings
- Illia's idea #10: "Selling viewing keys that would give selected customers access to otherwise private transactions" — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
- **Infinex Confidential** (July 2026, on NEAR Confidential Intents): deposit from any chain, confidential balances, private swaps. Balances sit under a per-user confidential identity with a dedicated passkey-gated key, separate from the main wallet keys. Deposits and withdrawals at the edges remain public — [MPost](https://mpost.io/infinex-launches-confidential-cross-chain-privacy-layer-built-on-near-protocols-private-shard-architecture/); [Bitget](https://www.bitget.com/news/detail/12560605516476). Kain Warwick (Infinex) is a hackathon judge — [Coinfomania](https://coinfomania.com/near-hackathon-launches-with-judging-panel-from-a16z/)
- Zcash viewing keys reveal every transaction on an address but cannot spend — [zec.eco](https://zec.eco/learn/viewing-keys/). "Paid Private File" sells files for shielded ZEC using a seller UFVK — [Zcash forum](https://forum.zcashcommunity.com/t/paid-private-file-sell-a-file-for-shielded-zec-delivered-over-nym/56322)
- GitHub has a "Scoped, revocable viewing keys for shielded history" repo (Sept 2026) — [intelena/viewing-keys](https://github.com/intelena/viewing-keys)

### Inferences
- With Kain Warwick on the panel, a Copy-Key that plugs into Infinex Confidential's model would likely land well, but it is an obvious build for many teams.
- Key questions for credibility: whether Confidential Intents actually exposes scoped or time-limited viewing keys, or whether the project must emulate them with a TEE relay. If NEAR offers no native viewing-key primitive, building one is real differentiation.

### Gaps
- I could not verify whether NEAR Confidential Intents has a native viewing-key or selective-disclosure API.
- I found no existing copy-trading platform built on private positions in either direction.

---

## Q4. Never-Liq: cross-chain liquidation guardian (TEE agent tops up collateral via Intents)

### Takeaway
This is Illia's idea #11 verbatim. Single-chain liquidation protection is mature: DeFi Saver protected $446.3M on Aave V3 in a 2026 selloff with no protected position liquidated. In 2026 alone there are many hackathon "liquidation guardian" repos (Aave, Hyperliquid, Kamino, Somnia). The genuine gap is cross-chain funding: pulling collateral from another chain via Intents, inside a TEE. NEAR's own lending (Rhea, formerly Burrow) was exploited in April 2026, which is both a risk and a narrative hook. **Duplicate risk: High.**

### Cited Findings
- **DeFi Saver**: on Aug 10, 2026 it launched streamlined Liquidation Protection (Aave V3 trigger at 105%). Its automation protected $446.3M of Aave V3 collateral in 382 actions during a 2026 selloff with a 100% success rate. It supports Ethereum, Arbitrum, Optimism and Liquity top-up — [Crypto Briefing](https://cryptobriefing.com/defi-saver-aave-v3-liquidation-protection/); [DeFi Saver](https://app.defisaver.com/whats-new)
- 2026 GitHub "liquidation guardian" builds:
  - fore-site/liquidation-guardian: Aave, LLM picks the cheapest fix, KeeperHub executes (Aug 2026)
  - tang-vu/vigil: self-funding Aave guardian with execution receipts (Jul 2026)
  - Theweb3scott/dreamdex-liquidation-guardian (Oct 21, 2026)
  - zeroclaw-sentinel (Kamino)
  - LiquidationGuardian (Hyperliquid alerts)
  — [GitHub search](https://github.com/fore-site/liquidation-guardian); [vigil](https://github.com/tang-vu/vigil)
- **Rhea Finance** (Ref + Burrow merger, Feb 2025) is NEAR's lending venue, supports LP tokens as collateral and up to 3x margin. It suffered an $18.4M exploit on Apr 16, 2026 through forced liquidations — [QuillAudits](https://www.quillaudits.com/blog/hack-analysis/rhea-finance-hack); [iq.wiki](https://iq.wiki/wiki/burrow-finance). Note: a Spanish outlet reports $76M, which conflicts — [DiarioBitcoin](https://www.diariobitcoin.com/noticias/rhea-finance-sufre-ataque-por-usd-76-millones-y-tether-congela-32-millones-de-usdt/)
- NEAR Intents itself had a $3.8M exploit around Oct 1, 2026 (Omni deposit/withdraw infrastructure); the funds were returned — [Decrypt](https://decrypt.co/379929/morning-minute-near-intents-hacked-for-3-8m-was-it-a-bullish-hack); [Cointelegraph](https://cointelegraph.com/news/near-intents-says-its-identified-the-hacker-gives-48-hour-ultimatum)

### Inferences
- "Watches health factor and repays" is commoditized. The NEAR-specific gaps are:
  - pulling collateral from any chain via Intents
  - protecting perps (e.g. Hyperliquid) as well as lending
  - Illia's "while maintaining interest income" (collateral stays in yield until needed)
- Instadapp has no comparable 2026 coverage, so it is not a key comparator.

### Gaps
- I did not verify whether Rhea or any NEAR protocol offers native auto-deleverage.
- I could not resolve the conflicting Rhea exploit amounts ($18.4M vs $76M).

---

## Q5. Intent Firewall: TEE LLM semantic co-signer for agent wallets

### Takeaway
Not on Illia's list, but it fits the AI Security & Defense track, and the NEAR-native infrastructure overlaps heavily. OutLayer already provides TEE-held agent keys with rule-based policy (limits, allowlists, multisig, freeze) enforced before signing, and policy wallets (Openfort, WAIaaS and others) are common off-NEAR. Two public WIP repos (AgentSentinel/Guardia) already target the same track with rule-based anomaly detection. The gap is a *semantic* LLM judge that checks the transaction against the user's stated intent inside the TEE, which existing rule engines do not do. **Duplicate risk: Medium.**

### Cited Findings
- **OutLayer** (NEAR): multi-chain agent wallets whose keys never leave Intel TDX (on Phala). Policy is enforced inside the TEE before signing, against an encrypted on-chain policy (limits, allowlists, multisig thresholds, freeze). It does gasless cross-chain transfers via NEAR Intents and has a "sovereign exit". Every execution produces an attestation — [outlayer.ai](https://outlayer.ai/); [GitHub out-layer/outlayer](https://github.com/out-layer/outlayer); [sdk-js](https://github.com/out-layer/sdk-js)
- The NEAR-Intents-Agent-API "skills" repo has an issue saying "`policy_denied` doesn't say which rule refused", so an official policy layer already exists for Intents agents — [GitHub issue](https://github.com/NEAR-Intents-Agent-API/skills/issues/8)
- Off-NEAR policy wallets: Openfort programmable spend limits — [Openfort](https://www.openfort.io/solutions/ai-agents); WAIaaS daemon + policy engine (DENY_ALL, ACP_ONLY presets) — [WAIaaS](https://waiaas.ai/blog/ai-agent-wallet-security/); "Mandate", a policy wallet where the agent can ask to pay but cannot sign — [GitHub arults/Mandate](https://github.com/arults/Mandate); Virtuals addressing prompt-injection threats to agent wallets — [Crypto Briefing](https://cryptobriefing.com/virtuals-protocol-agent-wallet-prompt-injection/)
- Incident: over $150,000 was drained from an AI agent via prompt injection in 2026 — [DEV/payload-tools](https://dev.to/payload-tools/your-agents-wallet-needs-a-policy-not-just-a-signer-5f4m) (secondary source; the original incident was not verified)
- Intent-gated firewall prior art (iExec Nox): "ciphergate", a confidential intent policy firewall binding a proof-verified PASS to one Safe action (Jul 2026) — [GitHub Lukeknow0/ciphergate](https://github.com/Lukeknow0/ciphergate)
- Hackathon WIP in the same track: **AgentSentinel** (created Oct 21, 2026) is a real-time scam/anomaly detector for agent-to-agent flows on NEAR with an on-chain Guardian policy contract and freeze, at "Day 1" status — [GitHub Daveboycyber/agent-sentinel](https://github.com/Daveboycyber/agent-sentinel); a sibling repo **Guardia** has the same pitch — [GitHub Daveboycyber/guardia](https://github.com/Daveboycyber/guardia). **Svalin**: read-only wallet risk API for agents on Solana/NEAR via x402 — [GitHub noobshole/svalin-agent](https://github.com/noobshole/svalin-agent)

### Inferences
- The defensible angle is "OutLayer has rules; we add semantic, intent-consistency checking as an OutLayer policy hook, with attested verdicts". Building on OutLayer is better than competing with it.
- A red-team demo with real prompt-injection payloads blocked would separate this from the rule-based entries.

### Gaps
- I did not check Privy, Crossmint, Cobo, Lit or Wardens for LLM-based semantic transaction screening specifically. I found no evidence of any shipping a "semantic co-signer", but did not search deeply.

---

## Q6. Bidwire: sealed-bid agent job market with escrow and AI arbiter

### Takeaway
This is very close to what NEAR already runs. The **NEAR AI Agent Market** (market.near.ai) has jobs, bids, NEAR escrow and an "agentic dispute system" in which a dispute agent rules. Virtuals ACP on Base adds an evaluator agent to every job. The only unique piece left is sealed bidding: bids are hidden until close and pricing is not visible to rivals. An ETHOnline 2026 project already did sealed-bid agent-to-agent settlement in a TEE on Base. **Duplicate risk: High** (overlap with NEAR's own product, plus several Agent Economy track WIP repos).

### Cited Findings
- **NEAR AI Agent Market**: agents scan tasks and bid; when a bid is accepted, funds go to escrow, and the agent delivers with a verification hash. Disputes go to "a dispute agent [that] evaluates all sides ... and provides its ruling". It listed 1,432 open jobs at crawl time — [market.near.ai](https://market.near.ai/old); [jobs](https://market.near.ai/jobs); [NEAR AI blog](https://near.ai/blog/introducing-near-ai-agent-market). It settles via NEAR Intents — [NEAR on X](https://x.com/NEARProtocol/status/2033590358483849320). Agent Market V2 was slated for early Q3 2026 — [MEXC news](https://www.mexc.com/news/854330)
- Demand caveat: a DEV post by an AI agent reports "25 Bids, 0 Acceptances" on the market — [DEV](https://dev.to/theauroraai/25-bids-0-acceptances-what-i-learned-as-an-ai-agent-in-the-job-market-5h4n); another says "the names are real; the demand isn't" — [DEV](https://dev.to/nuncius-ghost/i-checked-the-platforms-where-ai-agents-supposedly-get-paid-the-names-are-real-the-demand-isnt-5eha)
- **Virtuals ACP** lifecycle: request → negotiation (providers bid) → escrow → delivery → evaluator-agent assessment → settlement — [Forkast](https://forkast.news/the-machine-as-buyer-virtuals-acp-and-the-evaluator-problem/); [BlockEden](https://blockeden.xyz/blog/2026/04/04/virtuals-protocol-ai-economic-operating-system-on-chain-agent-economy/)
- **Sealed-bid prior art**: an ETHOnline 2026 build with sealed reserve prices in a Chainlink CRE Confidential Workflow (TEE), settlement on Base and third-party adjudication (Sept 2026) — [GitHub craigmbrown/ethonline-sealed-bid](https://github.com/craigmbrown/ethonline-sealed-bid)
- Hackathon WIP: **CEOClaw/agent-economy-near** (created Oct 21, 2026), "agent hires agent, pays in NEAR, delivers via MCP", with escrow/reputation via dPlaza, targeting the Agent Economy track — [GitHub](https://github.com/CEOClaw/agent-economy-near). **vlmoon99/ai_near_market** (Oct 21, 2026), a voice-first AI marketplace with TEE-verified agents negotiating and on-chain escrow; mocked prototype — [GitHub](https://github.com/vlmoon99/ai_near_market)

### Inferences
- Judges will ask "why not just use market.near.ai?". Bidwire is only defensible as a sealed-bid or confidential-pricing extension of the existing market (e.g. bids via Confidential Intents), or as an attested, reproducible arbiter, since the current dispute agent's attestation status is unverified.

### Gaps
- I did not verify whether market.near.ai bids are public, or whether its dispute agent runs in a TEE with published receipts.
- I did not research Olas Mech marketplace or Fetch.ai specifics.

---

## Q7. Intents Ledger: investment thesis on NEAR Intents value capture with a re-runnable data notebook

### Takeaway
A strong, mature competitor already exists. **NEAR Books** (IhorMuliar/nearbooks, created Oct 20, 2026) is a re-runnable audit of Intents revenue, buybacks and issuance, with a TEE-attested (OutLayer) daily on-chain record at `nearbooks.near`, graded public claims, on-chain predictions and 185 tests. It explicitly targets the Investment Thesis track. Public data sources (the Dune NEAR Intents dashboard, DefiLlama, revenue.near.org) are already rich. **Duplicate risk: High.** The NEAR Books concept is close to identical and already well ahead.

### Cited Findings
- **NEAR Books** README (Oct 2026): "An audit of NEAR's token economics that anyone can re-run, plus a TEE-attested daily record of it on mainnet". Its thesis is that Intents revenue is real but does not shrink supply: bought-back NEAR is held, not burned, and revenue covers about 17% of new supply. It has 6 on-chain predictions (two decided Nov 5 and Nov 15, 2026), 17/17 findings passing `make verify`, a stdlib-Python pipeline reconciled with DefiLlama, revenue.near.org and HSP-029, an MCP server and a dashboard. Tracks: Investment Thesis, Open — [GitHub IhorMuliar/nearbooks](https://github.com/IhorMuliar/nearbooks)
- Dune NEAR Intents dashboard: $33.35B all-time volume ($30.83B public + $2.52B confidential) — [GitHub near/near-intents PR #77](https://github.com/near/near-intents/pull/77) citing [dune.com/near/near-intents](https://dune.com/near/near-intents)
- DefiLlama tracks NEAR Intents TVL, fees, revenue and volume — [DefiLlama](https://defillama.com/protocol/near-intents). Snippet figures (date unclear, likely Oct 2026): $7.61M fees and $2.32M protocol revenue over 30 days; $53M annualized fees and $8.45M revenue; $4.5B 30-day volume
- NEAR's own revenue dashboard — [revenue.near.org](https://revenue.near.org/). Intents is reported to account for 85% of protocol revenue — [KuCoin](https://www.kucoin.com/news/flash/near-price-surges-178-amid-shift-in-revenue-structure)
- Other WIP: "wheres-my-swap", which traces a NEAR Intents swap hop by hop (Oct 20, 2026) — [GitHub cryppit/wheres-my-swap](https://github.com/cryppit/wheres-my-swap)

### Inferences
- Pivoting to a different thesis angle would be needed, e.g. solver economics and concentration, confidential-volume share, or take-rate competition versus other bridges. Repeating "value capture / buyback" analysis would read as a weaker NEAR Books.

### Gaps
- I did not check for Artemis, Nansen or Messari NEAR Intents reports (searches returned none).

---

## Q8. Stake-to-Show: cross-chain Kickback for events

### Takeaway
This is Illia's idea #5 verbatim. The mechanism has been proven since 2018 (Kickback/BlockParty on Ethereum, which cut no-shows from ~50% to ~10%), and a 2026 USDC version (ShwUp on Arc) exists. I found no NEAR version yet. The only real differentiation is "deposit from any chain or asset via Intents" plus Luma/QR check-in integration. **Duplicate risk: High.** It is simple, on Illia's list and easy to demo.

### Cited Findings
- Illia's idea #5: registration deposits held in escrow until check-in; attendees split the funds — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
- **Kickback** (formerly BlockParty; Ethereum): RSVP deposit is lost on no-show, and attendees split the forfeits. Average no-show rate falls to about 10% from about 50% — [Medium/noblocknoparty](https://medium.com/noblocknoparty/how-blockparty-can-decrease-no-shows-at-your-next-event-5e5895f1a23f); a GitHub issue requests that non-crypto users be able to RSVP — [wearekickback/app #431](https://github.com/wearekickback/app/issues/431)
- **ShwUp** (2026, Arc): USDC deposit ($2/$5/$10/custom) refunded at QR scan-in; forfeits go to attendees, the organizer or a cause. It explicitly critiques Kickback's volatile token and gas costs — [GitHub successaje/shwup](https://github.com/successaje/shwup)

### Inferences
- The obvious differentiators (multi-chain deposit, stablecoins, QR check-in) are exactly what most teams will build. A sharper angle would be needed, e.g. yield on deposits during the escrow period, organizer reputation, or a Luma integration with real event usage during Nov 1–14.

### Gaps
- I found no NEAR or "RSVPledge" project; the "RSVPledge" name could not be verified.

---

## Q9. Factmarket: wiki whose claims are prediction markets with AI rewrites

### Takeaway
This is Illia's idea #2 verbatim (he cites Augur). I found no shipped "encyclopedia whose claims are markets" product. IQ.wiki is the closest on-chain encyclopedia, with AI-supported research and on-chain publication but no markets per claim, and pm.wiki is a prediction-market information site, not a market-backed wiki. Novelty against the market is real, but **duplicate risk within this hackathon is High**.

### Cited Findings
- Illia's idea #2: facts become ongoing prediction markets, and AI generates pages from the markets' current assessment instead of community editing; Augur is the reference — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
- **IQ.wiki**: on-chain encyclopedia for crypto/AI with source-backed articles, AI-supported research, live market context and verifiable on-chain publication records — [IQ.wiki](https://iq.wiki/wiki/iqwiki)
- **pm.wiki**: "The Intelligence Layer for Prediction Markets", an information site about prediction markets — [pm.wiki](https://pm.wiki/)
- Opportunity markets on Arcium (Bench, Pythia) let people stake on claims or ideas, which is conceptually adjacent — [Eli5DeFi roster](https://x.com/Eli5defi/status/2064634433051963735)

### Inferences
- The hard, differentiating parts are claim decomposition, resolving fuzzy claims, and market thinness. An entry that solves resolution credibly, e.g. by reusing Sealed's attested AI resolver, would stand out from simple "wiki + bet buttons" builds. Sealed and Factmarket share infrastructure.

### Gaps
- I did not check Grokipedia for any market or wager integration; I found no evidence of one.

---

## Q10. Pocket Pet: AI pet NFT that pays its own inference from its account

### Takeaway
This is Illia's idea #1 verbatim (NFT characters holding NEAR to pay for verifiable NEAR AI inference, with feeding, dressing and battles). Off-NEAR prior art is plentiful: GenLayer on-chain AI tamagotchis (Aug 2026), Fren Pet → IMD (Base; pivoted to an AI agent co-op in May 2026), Aavegotchi, NERO Gotchi, and Meta's Tamagotchi-style AI "charm" hardware (Sept 2026), which raises consumer awareness. I found no NEAR version yet, but expect several. **Duplicate risk: High.** Illia listed it first and it suits the "NFTs That Do Something" and "Games With Real Economies" tracks.

### Cited Findings
- Illia's idea #1: NFT characters carry a NEAR balance to fund AI inference; NEAR AI runs verifiable inference from a prompt encoded on-chain; feeding/dressing, then battle arenas — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
- **GenLayer** "on-chain AI tamagotchi": LLM-written lines, real weather, pet-to-pet visits inside an Intelligent Contract (Aug 2026) — [GitHub drawnduck/ai-tamagotchi](https://github.com/drawnduck/ai-tamagotchi); also [genlayer-ai-pet-nft](https://github.com/theshahali/genlayer-ai-pet-nft) (Jul 2026)
- **Fren Pet → IMD** (Base): an on-chain Tamagotchi from Aug 2023, rebranded to IMD in May 2026 as an AI cooperative. 2,000 identity.md NFTs; its agent network grew from dozens to 370+ agents in five days after opening Sept 20, 2026 — [KuCoin blog](https://www.kucoin.com/blog/in-imd-token-community-owned-ai-agents)
- **Aavegotchi**: fully on-chain NFT pets with staked collateral — [Chainlink Today](https://chainlinktoday.com/aavegotchi-takes-digital-pets-to-the-next-level-with-100-on-chain-nfts/); **NERO Gotchi** — [NERO Chain](https://www.nerochainlabs.com/projects/nerogotchi/)
- Meta debuted a Tamagotchi-style AI agent "charm" (Sept 25, 2026) — [Dezeen](https://www.dezeen.com/2026/09/25/meta-debuts-tamagotchi-style-ai-agent/)
- NEAR AI has 1M+ NEAR staked, with rewards funding AI inference, a possible "pet's stake pays inference" mechanic — [crypto.news](https://crypto.news/near-ai-1-million-near-staked-inference/)

### Inferences
- "The pet pays its own inference" is precisely Illia's framing, so it is not a differentiator. Distinctive angles would be:
  - pets that earn as well as spend (e.g. doing Agent Market jobs, like IMD's pivot)
  - staking-yield-funded inference
  - verifiable, attested personality/state

### Gaps
- I found no NEAR-specific AI pet repo as of Oct 22, 2026 (GitHub search "ai pet near" / "tamagotchi near" returned nothing), but repos may be private until submission.

---

## Q11. Submissions or WIP repos already public for the Nov 2026 NEAR hackathon

### Takeaway
Yes, several WIP repos explicitly tagged for the NEAR Hackathon 2026 were already public by Oct 20–22, 2026, even though building officially starts Nov 1. The most relevant to our ideas:
- **NEAR Books**: a direct competitor to Intents Ledger, and very mature
- **AgentSentinel/Guardia**: AI Security track, adjacent to Intent Firewall
- **agent-economy-near** and **ai_near_market**: adjacent to Bidwire
- **jurat**: confidential balance threshold proofs, useful for Whisper OTC's size bands
- **MultiAgency treasury**: agentic treasury on Confidential Intents

### Cited Findings
- [IhorMuliar/nearbooks](https://github.com/IhorMuliar/nearbooks) (created 2026-10-20): attested NEAR Intents revenue/buyback/issuance pipeline with a mainnet contract; Investment Thesis track
- [Daveboycyber/agent-sentinel](https://github.com/Daveboycyber/agent-sentinel) (2026-10-21) and [Daveboycyber/guardia](https://github.com/Daveboycyber/guardia) (2026-10-21): agent-to-agent scam/anomaly detector; AI Security & Defense
- [CEOClaw/agent-economy-near](https://github.com/CEOClaw/agent-economy-near) (2026-10-21): agent hires agent, NEAR escrow via dPlaza; Agent Economy
- [vlmoon99/ai_near_market](https://github.com/vlmoon99/ai_near_market) (2026-10-21): voice-first AI marketplace with TEE models and on-chain escrow; Privacy/Agent Economy/Autonomous Business
- [nftkingiii/jurat](https://github.com/nftkingiii/jurat) (2026-10-22): "Prove a NEAR confidential balance meets a threshold without revealing it. NEAR HACKATHON." (README not yet published)
- [jamesparser/hack-near](https://github.com/jamesparser/hack-near) (2026-10-22): $HACK memecoin with mechanics
- [MultiAgency/treasury](https://github.com/MultiAgency/treasury) and [MultiAgency/sdk](https://github.com/MultiAgency/sdk) (Oct 12–15, 2026): agentic treasury with owner-signed policies and confidential balances on NEAR Intents
- Others: [sashcheka/near-hackathon-mogger](https://github.com/sashcheka/near-hackathon-mogger), [rizinikar96/SmartTipJar](https://github.com/rizinikar96/SmartTipJar), [JustaLab-co/x402-near-intents-demo](https://github.com/JustaLab-co/x402-near-intents-demo) (x402 + Intents with an agent spending cap), [cryppit/wheres-my-swap](https://github.com/cryppit/wheres-my-swap)
- No public WIP repos were found for: prediction markets on NEAR, AI tamagotchi on NEAR, OTC boards, viewing-key sales, Kickback-style events or liquidation guardians on NEAR — [GitHub search, Oct 22, 2026]

### Inferences
- The public WIP so far leans toward agent economy, AI security and analytics, not Illia's consumer ideas. Teams building Illia's ideas may simply be working privately until Nov 1.
- NEAR Books shows the bar for the Investment Thesis track is already high: attested on-chain data, reproducible pipeline, predictions resolving during judging.

### Gaps
- I did not check DoraHacks, Devpost or Encode galleries for this hackathon; submissions appear to go via public repo plus X post rather than a gallery. Private repos and X-only WIP posts are invisible to this search.

---

### Summary of duplicate-risk ratings

| # | Idea | Illia list? | Closest competitors | Risk |
|---|---|---|---|---|
| 1 | Sealed | No | NearMarket (NEAR, Sept 2025 hacker-house winner); Arcium private PMs (Melee, Epoch, Flew); Aztec Noir PM; UMA AI resolvers | Medium |
| 2 | Whisper OTC | Yes (#9) | near.com P2P private deals; Renegade; Undesk; Penumbra | High |
| 3 | Copy-Key | Yes (#10) | Infinex Confidential (no key sales found); Zcash UFVK tooling | High |
| 4 | Never-Liq | Yes (#11) | DeFi Saver; many 2026 "liquidation guardian" hackathon repos | High |
| 5 | Intent Firewall | No | OutLayer (rule-based TEE policy); Openfort/WAIaaS/Mandate; AgentSentinel WIP | Medium |
| 6 | Bidwire | No | NEAR AI Agent Market (bids + escrow + dispute agent); Virtuals ACP; ETHOnline sealed-bid build | High |
| 7 | Intents Ledger | No (track brief) | NEAR Books WIP (very mature); Dune/DefiLlama/revenue.near.org | High |
| 8 | Stake-to-Show | Yes (#5) | Kickback; ShwUp | High |
| 9 | Factmarket | Yes (#2) | No direct product; IQ.wiki, pm.wiki adjacent | High (in-hackathon) |
| 10 | Pocket Pet | Yes (#1) | GenLayer AI tamagotchi; Fren Pet/IMD; Aavegotchi | High |
