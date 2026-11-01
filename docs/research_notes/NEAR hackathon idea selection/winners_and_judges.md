# Past NEAR Hackathon Winners and Nov 2026 NEAR Hackathon Judges' Preferences

Research date: Oct 22, 2026. All quote dates flagged. Where a page could not be fetched (Devpost galleries returned 403), this is listed under Gaps rather than filled in.

## Q1. The Nov 2026 NEAR Hackathon itself: format, judges, criteria, submission requirements

### Takeaway
It is a $250K, two-week online hackathon (Nov 1–14, 2026) with 13 tracks. Each track pays $10k/$3k/$2k, plus one $55k grand prize. Solo builders are explicitly welcome. Submission is a public GitHub repo plus a public X demo post with video or screenshots. Seven human judges are confirmed, and Claude Code and Codex act as AI judges, so the repo and README will likely be machine-read.

### Cited Findings
- Dates: development runs Nov 1–14, 2026 (deadline Nov 14, 23:59 UTC). Judging and results are Nov 16–18, 2026 — [nearhackathon.com](https://nearhackathon.com/)
- Prizes: $250K total. Grand Prize $55,000 (1 winner). Each of the 13 tracks pays 1st $10,000, 2nd $3,000 and 3rd $2,000 — [nearhackathon.com](https://nearhackathon.com/)
- The 13 tracks: Unstoppable DeFi; Investment Thesis; Privacy & Private AI; Autonomous Business; AI Swarms; AI Security & Defense; Agent Economy; Real-World Money; Games With Real Economies; NFTs That Do Something; Memecoins With Mechanics; Social Money; Open Innovation — [nearhackathon.com](https://nearhackathon.com/)
- Judges: Illia Polosukhin (NEAR), Eddy Lazzarin (a16z crypto), Mert Mumtaz (Helius), Avichal Garg (Electric Capital), Kain Warwick (Synthetix & Infinex), Haseeb Qureshi (Dragonfly), Stepan Gershuni (cyber•Fund). Claude Code and Codex (Anthropic & OpenAI) are listed as AI judges — [nearhackathon.com](https://nearhackathon.com/); confirmed in the [NEAR Foundation / Mert council press release, Oct 15, 2026](https://www.prnewswire.co.uk/news-releases/helius-ceo-mert-mumtaz-joins-the-near-foundation-council-302910016.html)
- Judging criteria (the site says these are "based on previous NEAR hackathons"): technical implementation, design, impact, originality, sustainability — [nearhackathon.com](https://nearhackathon.com/)
- Submission requirements: a public GitHub repo, plus a public demo post on X with video or screenshots that references "NEAR HACKATHON". Both links go in the form. One submission per team, but one submission can be entered in multiple tracks. No wallet connection is needed. Solo builders or teams are welcome — [nearhackathon.com](https://nearhackathon.com/)
- Stated key themes: "programmable money," autonomous agents, cross-chain execution via NEAR Intents, AI-native applications — [nearhackathon.com](https://nearhackathon.com/)
- Press framing (Oct 19, 2026): the focus is on building agentic applications that make confidentiality a core primitive on NEAR — [Coinfomania](https://coinfomania.com/near-hackathon-launches-with-judging-panel-from-a16z/)
- Ecosystem context in the press release (Oct 15, 2026): NEAR Intents has $33B in all-time volume and confidential TVL is over $160M. near.com offers private cross-chain transactions and position privacy by default — [PR Newswire](https://www.prnewswire.co.uk/news-releases/helius-ceo-mert-mumtaz-joins-the-near-foundation-council-302910016.html)

### Inferences
- The track structure favors a focused, track-native project. A solo builder competes for one of 39 podium slots (13 tracks × 3), not only the single grand prize. Picking a less-crowded track (for example Investment Thesis, AI Security & Defense, or Real-World Money rather than Agent Economy or Privacy) could raise the odds of placing.
- Since one submission can enter multiple tracks, the best idea plausibly fits two or three tracks at once (for example Privacy + Unstoppable DeFi + AI Security).
- Because Claude Code and Codex judge, the public repo will likely be read and scored by machines. A clear README, clean architecture, working tests and a real deployed contract or mainnet transaction are probably worth more than usual.
- The X demo post is a required artifact, so a short, crisp video demo is effectively mandatory.

### Gaps
- No weighting of the criteria, and no statement of how the AI judges' scores combine with the human judges' scores.
- No judge statements found specifically about what makes a good hackathon submission (for example "mainnet required" or "video length").

## Q2. Past NEAR hackathon winners (2024–2026): what won, what primitives, polish, solo vs team

### Takeaway
Recent NEAR winners have mostly been working agent or app integrations built on NEAR-specific primitives: Intents, Chain Signatures, Shade Agents/TEE and NEAR AI. Many plug into existing DeFi protocols or popular verticals such as prediction markets, betting, BTC tipping and trading agents. Sponsor bounties drive a large share of winners, and organizers explicitly reward "real working demos." Public data on team size is almost nonexistent.

### Cited Findings
**One Trillion Agents Hackathon (early 2025, NEAR + Hackbox)**
- Bitte reported more than 2,000 participants and a $100,000 prize pool, with 40 top submissions. 14 of those (more than 45%) used Bitte's agent framework and embeddable chat (article dated Mar 17, 2025). Note: the brief's figures of ~$102.5k and 1,993 participants could not be verified against a primary page — [Bitte Substack](https://bitteprotocol.substack.com/p/from-experiment-to-adoption-how-bittes)
- Tracks: AI Agents (Shade, NEAR AI), Chain Abstraction, Intents & Programmable UX, Dev Tooling & Docs — [search summary of Devpost updates](https://1t-agents.devpost.com/updates)
- Bitte bounty winners:
  - CoolFi: AI crypto management using Bitcoin + NEAR Intents + Twitter
  - betVEX AI Agent: esports betting assistant
  - SatSlinger: BTC tipping agent for Twitter content
  - Gains.Trade AI Agent: automated forex/crypto trading
- Notable projects: Lido Assistant, Veax AI liquidity assistant, Balancer Assistant, HAT Coin Agent (meme token auctions/staking), Bitcoin Agent (BTC via Chain Signatures), Crypto Sentiment Agent — [Bitte Substack, Mar 17, 2025](https://bitteprotocol.substack.com/p/from-experiment-to-adoption-how-bittes)

**NEAR hacker houses**
- NearMarket, "an AI first prediction market with NEAR Intent implementation," won first prize in the NEAR hackathon at Loops Hacker House on Sept 27, 2025 — [Medium post by the author (Ravikant Agrawal); page returned 403, so details come from the search snippet](https://ravikantagrawal.medium.com/nearmarket-an-ai-first-prediction-market-with-near-intent-implementation-2f0d7dff21f8)
- At the NEAR Chiang Mai Hacker House (Oct 2024), 6 of 7 project submissions won prizes (86%) — [Marmaj (search summary)](https://marmaj.org/hacker-house/)

**[REDACTED] Hackathon (NEAR, 2024)**
- Ran Sept 5–Oct 31, 2024 online, with a live finale in Bangkok Nov 9–11, 2024. $310,000 in prizes and 1,642 participants. Native Track prizes: $50k for the top submission, $20k for each of the next 3 high-potential projects, and $10k each for Best of AI, Best of Chain Abstraction, Best Tech and Best DeFi, plus up to 10 honorable mentions of up to $5k. The theme was AI x Web3 / "reclaim your sovereignty" — [Devpost (search summary)](https://redacted.devpost.com/); [Devpost on X](https://x.com/devpost/status/1826303302037893301)

**ETHGlobal NEAR bounties**
- ETHGlobal Unite (DeFi): "Best 1inch Fusion+ Solver Built with NEAR's Shade Agent Framework" paid $2,000, plus $4,000 split across up to 4 runners-up. Requirements: produce valid Fusion meta-orders via Chain Signatures, comprehensive docs and setup instructions, and end-to-end functionality. A modular, extensible architecture earned a bonus — [ETHGlobal](https://ethglobal.com/events/unite/prizes/near)

**NEARCON 2026 (San Francisco, Feb 23–24, 2026)**
- Innovation Sandbox: a virtual builder sprint Jan 26–Feb 16, 2026, "designed to elevate real working demos that demonstrate NEAR's technical capabilities across AI, privacy, intents, and account abstraction." Winners were announced Feb 19 and showcased at NEARCON — [NEARCON Innovation Sandbox (search summary)](https://nearcon.org/innovation-sandbox/)
- NEARCON "Agent Wars" paid 1,000 NEAR per challenge winner, announced Feb 24, 2026 — [nearcon.org (search summary)](https://nearcon.org/the-agent-hackathon/)
- Useful Agents Hackathon (NEAR AI + SF Compute + Electric Capital): $20k prize pool, with a Shade Agents workshop — [Luma](https://luma.com/7jqs1l34)

**Other**
- Zcash x NEAR Intents Hackathon (NEAR Hackbox on TAIKAI): Zcash + Intents + AI agents + Chain Signatures, 94 participants. Winners were not retrievable — [TAIKAI](https://taikai.network/en/hackbox/hackathons/zcashxnear/prizes)

### Inferences
- Winning patterns:
  - Use at least one NEAR-specific primitive (Intents, Chain Signatures, Shade/TEE, NEAR AI) in a way that is visible in the demo.
  - Connect to real external liquidity, protocols or social surfaces (Twitter, BTC, existing DeFi).
  - Ship something that works end to end. Organizers repeatedly emphasize "working demos," "end-to-end functionality" and documentation.
- Prediction markets have a precedent of winning NEAR events (NearMarket, Sept 2025), and betting-style agents placed at One Trillion Agents (betVEX).
- Hacker-house prize density was high (6/7 at Chiang Mai). Large online events are far more competitive, with a winner rate of about 2% (40 "top submissions" out of 2,000+).

### Gaps
- Devpost galleries for One Trillion Agents and [REDACTED] returned 403, so grand-prize winner names, team sizes and project details for those events are missing.
- NEARCON 2026 Innovation Sandbox and Agent Wars winner names were not found.
- No winner lists were found for ETHGlobal NEAR prizes in 2025–2026, the Zcash x NEAR hackathon, or NEAR Intents-specific hackathons.
- No reliable data on solo vs team winners at any NEAR event.

## Q3. Judges' stated views (with dates)

### Takeaway
The panel leans toward confidential, cross-chain markets ("market of markets") and agentic commerce. Illia has published a public list of 13 app ideas, and several candidate ideas map directly onto it. Haseeb is publicly skeptical of new prediction-market offerings and of agent-to-agent payments, but bullish on AI for security and on perps. Avichal emphasizes the agent-wallet liability frontier. Kain is focused on CEX-grade DeFi UX and already ships Infinex Confidential on NEAR.

### Cited Findings
**Illia Polosukhin (NEAR co-founder)**
- Oct 7, 2026 (The Block):
  - "agent is a front-end and markets is a back-end" (about Agent Market)
  - "AI is a front-end, blockchain is a back-end"
  - On CEXs: "I think for a lot of things now, you don't need it"
  - NEAR Intents handles "any asset to any asset"
  - Agent Market extends intents to natural-language tasks
  - Also mentioned: the confidential shard, tokenized stocks and fiat features — [The Block](https://www.theblock.co/news/ecosystems/2026-10-07-nears-polosukhin-sees-shrinking-need-for-centralized-exchanges-as-onchain-tools-expand-417912)
- NVIDIA GTC talk (2026; exact date not verified) on agentic market primitives: agents express and match intents directly, using programmatic escrow, agentic dispute resolution, and intent-based matching and settlement. His thesis is that markets are built for humans and agents need purpose-built infrastructure. He expects agents to handle "the majority of transactions, orders, discovery, negotiation, hiring, contracting, completing work, and even disputes" — [search summary citing NEARWEEK Issue 246](https://nearweek.substack.com/p/nearweek-issue-246) and [YouTube talk](https://www.youtube.com/watch?v=5mweXYl8kqI) (secondary; not fetched in full)
- Oct 3, 2026: Illia's 13 app ideas, as reported by [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/):
  1. AI Tamagotchi / AI pet NFTs that carry NEAR balances to pay for inference ("NEAR AI running verifiable inference from a prompt encoded onchain"), with feeding, dressing and battle arenas
  2. AI encyclopedia whose fact pages come from prediction markets (Augur-style)
  3. Private AI model testing on private datasets, with certified results and test-set hashes
  4. Universal checkout widget via NEAR Intents, aimed at merchants and Shopify
  5. Event registration with escrowed deposits released at check-in, where no-shows' deposits go to attendees, across chains and assets
  6. OTC marketplace solving counterparty discovery for NEAR Intents "private deals"
  7. Social trading with viewing keys, where public P&L is shown and followers can copy
  8. Position management ("never get liquidated") for lending and perps via Intents
  9. Delta-neutral spot + perp tool
  10. Private code-review agent via NEAR AI
  11. Medical second opinion with encrypted data on NEAR AI, using crypto and fiat payments and prompts stored in NFTs
  12. Private Granola-style transcription funded by staking
  13. Cap-table and fundraising tool
  - Distribution advice: Aurora wallet via Intent Connect, NEARLegion, other communities, Product Hunt, X.
- Oct 15, 2026, on Mert: "an early NEAR Intents adopter… as we work to bring private assets and markets to every chain" — [PR Newswire](https://www.prnewswire.co.uk/news-releases/helius-ceo-mert-mumtaz-joins-the-near-foundation-council-302910016.html)

**Mert Mumtaz (Helius CEO, joined NEAR Foundation Council Oct 15, 2026)**
- Oct 15, 2026: "There is no world in which crypto succeeds but distinct markets are gatekept exclusively through CEXes. We already have that and it's called TradFi. For crypto to win, we need connected, unstoppable liquidity at planetary scale. A market of markets. Neither Solana, Zcash, or Bitcoin can win on their own, we must work together. And NEAR is how." — [PR Newswire](https://www.prnewswire.co.uk/news-releases/helius-ceo-mert-mumtaz-joins-the-near-foundation-council-302910016.html)
- Aug 7, 2026 (Genfinity podcast): "Everything you'd expect from a bank, you'll be able to do on Solana. Fully onchain. No compromises." — [Genfinity](https://genfinity.io/2026/08/07/helius-mert-mumtaz-solana-privacy-protocol-encrypted-balances/)
  - Paraphrased views: crypto lacks bank-level confidentiality, and encrypted balances and MEV resistance are prerequisites for regulated markets.
  - He drew an analogy between protocol bugs and pacemaker firmware (AI and code security).
- Rings (Helius, private beta, 2026): a Solana privacy protocol with confidential rings (asset and amount hidden) and anonymous rings (sender, recipient, asset and amount hidden), plus configurable compliance controls. Mumtaz frames encrypted order flow as making trading "MEV-proof by design," which is a market-structure argument — [Solana Compass](https://solanacompass.com/news/helius-ceo-reveals-rings-solanas-first-onchain-privacy-protocol-now-in-private-beta)

**Kain Warwick (Synthetix / Infinex)**
- Infinex Confidential launched July 18, 2026 on NEAR's Confidential Intents. It supports deposits from any chain, confidential balances, private swaps and withdrawals to any destination. It runs on a private NEAR shard with no public RPC or explorer and a permissioned, "trust-minimized" validator set — [MPost](https://mpost.io/infinex-launches-confidential-cross-chain-privacy-layer-built-on-near-protocols-private-shard-architecture/); [Cryptowisser](https://www.cryptowisser.com/news/infinex-integrates-near-protocols-confidential-intents)
- Infinex previously integrated NEAR Chain Signatures — [search summary](https://www.theblock.co/profile/348244/kain-warwick)
- The Defiant podcast (June 8, 2026, per search summary): Infinex aims for a CEX-like, non-custodial UX. The conversation also covered Hyperliquid competition — [The Defiant (Spotify)](https://creators.spotify.com/pod/profile/thedefiant/episodes/Kain-Warwick-on-Infinex--Synthetix--and-the-Future-of-DeFi-UX-and-Stability-e2unnak)
- Kain did an interview titled "How AI and OpenClaw Will Trade For You," which suggests interest in AI trading agents (date not retrieved) — [YouTube](https://www.youtube.com/watch?v=QTEc9awGrrw)
- Synthetix is building a perp DEX on Ethereum L1 — [Bankless](https://www.bankless.com/read/synthetix-l1-perp-dex)

**Haseeb Qureshi (Dragonfly), 2026 predictions, posted Dec 29, 2025** — [haseebq.com](https://haseebq.com/2026-predictions/); [CoinDesk, Dec 30, 2025](https://www.coindesk.com/markets/2025/12/30/dragonfly-managing-partner-lays-out-his-2026-crypto-predictions)
- Prediction markets: "Prediction markets grow like crazy"; "Polymarket continues to steamroll the culture." Also: "90% of prediction market offerings are totally ignored" and wind down by end of year, "the explosion of other platforms tacking on prediction markets mostly flop," "direct-to-consumer outperforms," and "almost all of the demand in 2026 is sourced directly from Polymarket, Robinhood, and Kalshi."
- Agents: "AI agents will still not be 'paying each other' or spending any meaningful money in 2026." Wallet automation "remains minimal."
- AI: uses "remain within software engineering and security. Everything else remains a prototype." Small teams of fewer than 10 people ship scaled products, and "2026 is dubbed the year of the agentic startup."
- Perps: market share consolidates to about 3 venues, and equity perps reach more than 20% of DeFi perp volume.
- Stablecoins: supply grows about 60%, and stablecoin-backed cards grow 1,000%.

**Eddy Lazzarin (a16z crypto CTO)**
- Quote attributed to Lazzarin in a search summary (exact source and date unverified): "Crypto makes money easier for software to control. AI makes software easier for humans to control. Wire those together and the surface area for new applications becomes enormous." — [a16z frontier Substack (could not retrieve text)](https://a16zfrontier.substack.com/p/ai-just-gave-you-superpowers-now)
- a16z posted on X about Lazzarin and Dan Boneh discussing how AI's math leap could compress decades of cryptographic trust-building (date not retrieved) — [a16z on X](https://x.com/a16z/status/2110113713487515991)
- **Correction to brief:** the a16z crypto podcast "Why privacy will be the biggest moat in crypto" (Jan 30, 2026) features **Ali Yahya** and Robert Hackett, **not** Eddy Lazzarin. Its claims: "privacy — not performance — will determine the long-term winners"; "privacy creates lock-in and winner-take-most dynamics"; "secrets are harder to move than assets" — [a16z crypto](https://a16zcrypto.com/posts/podcast/privacy-moat-crypto). This is the a16z house view, but attributing the "privacy moat" line to Eddy personally is not verified.

**Avichal Garg (Electric Capital)**
- NEARCON 2026 panel (Feb 24, 2026):
  - "What happens if there's not a human behind it at all?"
  - "It's some piece of code that owns a wallet, executing code to make more money… How does liability work in that case? I actually don't know."
  - "You can't punish an AI. You can turn them off, but they don't care."
  - He compared the moment to the 19th-century invention of the LLC.
  - "The cost of participating in the economy has come down so far… anybody in the world, with relatively little money, being able to create value."
  - [CoinDesk](https://www.coindesk.com/business/2026/02/24/crypto-wallets-for-ai-agents-are-creating-a-new-legal-frontier-says-electric-capital)
- Electric Capital co-sponsored NEAR AI's Useful Agents Hackathon — [Luma](https://luma.com/7jqs1l34)

**Stepan Gershuni (cyber•Fund)**
- cyber•Fund (creators of Lido and P2P.org) frames itself as "The First Monastery for AI-native Founders." Its thesis is a "cybernetic economy": companies that are "programmable, self-improving, run by agents under human direction," where tiny teams get massive leverage. Gershuni runs cybos.ai and hosts AI-native-startup workshops with "no slides… only live demos" of real agent workflows — [cyber.fund](https://cyber.fund/content/ai); [cybos.ai](https://www.cybos.ai/); [Luma](https://luma.com/8pocehw5) (via search summary; dates not retrieved)

### Inferences
- Illia is the anchor judge, and his Oct 3 list amounts to a published wishlist. Ideas on it (OTC, viewing-key copy trading, liquidation guardian, event deposits, prediction-market wiki, AI pet) will score "on-thesis" with him. They will also be the most-copied ideas among the roughly 2,000 likely entrants, which hurts originality scores.
- Mert, Kain and Illia all converge on confidential cross-chain trading through NEAR Intents, a "market of markets" in which private balances defeat MEV. A private trading primitive that actually uses Confidential Intents fits three judges at once.
- Haseeb is the most likely judge to mark down a generic new prediction market or an "agents pay agents" economy. He is the most likely to reward AI-for-security and perps tooling.
- Stepan's "live demos only" ethos and Haseeb's "agentic startup" prediction suggest both value a real, running autonomous workflow over slides. The Autonomous Business and AI Swarms tracks fit Stepan.
- Avichal's liability framing makes guardrails and policy enforcement for agent wallets (a semantic firewall) a natural fit for him.

### Gaps
- No direct statement from Illia on memecoins or confidential AI beyond the 13 ideas, and no hackathon-specific quotes from him. The "Memecoins With Mechanics" track exists, but no judge quote on memecoins was found.
- The exact date of Illia's GTC talk was not verified, and no verbatim quotes were found.
- No 2026 Kain quote on privacy or hackathons, and no Kain quote about Infinex Confidential itself.
- Eddy Lazzarin's personal 2026 positions on privacy and agent swarms are not verified (see the correction above).
- No primary text was found for Stepan Gershuni's quotes on "agentic substrates."
- No judge statements were found on what makes a good hackathon submission (mainnet, README, video).

## Q4. Which candidate ideas each judge would likely favor

### Takeaway
The strongest multi-judge overlaps are private OTC board, liquidation guardian and viewing-key copy trading. Each is on Illia's list, fits the Mert/Kain confidential-markets thesis and Kain's perps/DEX focus, and is not targeted by Haseeb's skepticism. The semantic agent-wallet firewall is the best off-list idea (AI Security track: Haseeb, Avichal, Mert). Confidential prediction markets and agent job markets carry Haseeb risk.

### Cited Findings (the evidence each mapping rests on)
- Ideas taken directly from Illia's Oct 3, 2026 list:
  - OTC (#6), viewing-key social trading (#7), "never get liquidated" (#8), event deposits (#5), prediction-market encyclopedia (#2), AI pet NFT (#1) — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
- Agentic-market primitives relevant to a sealed-bid agent job market:
  - Illia's GTC primitives (escrow, dispute resolution, intent matching) and Agent Market, where "agent is a front-end and markets is a back-end" (Oct 7, 2026) — [The Block](https://www.theblock.co/news/ecosystems/2026-10-07-nears-polosukhin-sees-shrinking-need-for-centralized-exchanges-as-onchain-tools-expand-417912)
- Haseeb's skepticism on agent payments and prediction markets, and his bullishness on AI security and perps (Dec 29, 2025) — [haseebq.com](https://haseebq.com/2026-predictions/)
- Mert's "market of markets" and confidentiality views (Oct 15 and Aug 7, 2026) — [PR Newswire](https://www.prnewswire.co.uk/news-releases/helius-ceo-mert-mumtaz-joins-the-near-foundation-council-302910016.html); [Solana Compass](https://solanacompass.com/news/helius-ceo-reveals-rings-solanas-first-onchain-privacy-protocol-now-in-private-beta)
- Kain's Infinex Confidential runs on NEAR Confidential Intents (July 18, 2026) — [MPost](https://mpost.io/infinex-launches-confidential-cross-chain-privacy-layer-built-on-near-protocols-private-shard-architecture/)
- Avichal on agent-wallet liability (Feb 24, 2026) — [CoinDesk](https://www.coindesk.com/business/2026/02/24/crypto-wallets-for-ai-agents-are-creating-a-new-legal-frontier-says-electric-capital)
- Precedent: NearMarket, an AI prediction market built on Intents, won a NEAR hacker house in Sept 2025 — [Medium](https://ravikantagrawal.medium.com/nearmarket-an-ai-first-prediction-market-with-near-intent-implementation-2f0d7dff21f8)

### Inferences (judge-fit matrix; my assessment, not judge statements)

| Idea | Likely track(s) | Likely favorable | Likely skeptical / risk |
|---|---|---|---|
| Confidential prediction market ("Sealed") | Privacy & Private AI; Unstoppable DeFi | Mert (encrypted order flow), Illia (confidential markets), Eddy (a16z privacy-moat house view) | Haseeb ("90% of prediction market offerings are totally ignored"). A prediction market has already won a NEAR event, which could cut both ways on originality |
| Private OTC board | Privacy; Unstoppable DeFi | Illia (#6 on his list), Mert (market of markets, privacy), Kain (Infinex Confidential uses the same rails) | High collision risk because it is on Illia's public list |
| Viewing-key copy trading | Social Money; Privacy | Illia (#7), Mert (compliance/viewing-key model similar to Rings), Kain (trading UX) | Collision risk. Hard to demo with real P&L in 2 weeks |
| Liquidation guardian | Unstoppable DeFi; AI Security & Defense; Autonomous Business | Illia (#8), Kain (perps), Haseeb (perps growth; security), Stepan (autonomous agent) | Collision risk. It must actually execute through Intents to be credible |
| Semantic agent-wallet firewall | AI Security & Defense; Agent Economy | Haseeb (AI's real uses are "engineering and security"), Avichal (agent liability), Mert (code-security emphasis), Illia (agents transacting needs safety) | Can look like "infra with no users." It needs a live attack-blocked demo |
| Sealed-bid agent job market | Agent Economy; AI Swarms | Illia (GTC escrow, dispute resolution and intent matching; Agent Market), Stepan (AI-native economy) | Haseeb (agents not paying each other in 2026). It overlaps with NEAR's own Agent Market (market.near.ai) |
| Data-driven investment thesis | Investment Thesis | The VC judges (Haseeb, Eddy, Avichal, Stepan) evaluate theses professionally. Avichal and Electric Capital are known for developer-activity data | No judge statement found. Unclear how "sustainability" or "technical implementation" criteria apply to a thesis |
| Cross-chain event deposits | Real-World Money | Illia (#5, cross-chain escrow via Intents) | Lower ceiling with the VC and DeFi judges. Collision risk |
| Prediction-market wiki | Open Innovation; Privacy/AI | Illia (#2) | Haseeb (prediction-market skepticism). Needs liquidity to be meaningful |
| AI pet NFT | NFTs That Do Something; Games With Real Economies | Illia (#1, verifiable NEAR AI inference paid from the NFT's balance) | Likely the most-copied consumer idea. Little appeal to the DeFi/VC judges |

- Overall: for a solo builder, a confidential-trading primitive (OTC board, or a liquidation guardian that runs on Confidential Intents) offers the widest judge coverage. A semantic agent-wallet firewall offers the best mix of judge fit and low collision (Haseeb + Avichal + Mert, in the AI Security track). Building directly from Illia's list risks crowding unless there is a strong differentiator.

### Gaps
- No judge has commented on any of these specific candidate projects.
- How many entrants target each track is unknowable before submissions close.
