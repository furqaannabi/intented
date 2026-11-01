# NEAR HACKATHON (Nov 1–14, 2026): Official Details for a Solo Entrant

Research date: Oct 22, 2026. Main sources: the official site https://nearhackathon.com (homepage text, FAQ, submission form) and the official agent brief https://nearhackathon.com/HACKATHON.md, both fetched directly. Labels used below: **[OFFICIAL]** means it comes from nearhackathon.com or HACKATHON.md. **[PRESS]** means a NEAR Foundation press release. **[MEDIA]** means third-party coverage. The event runs on NEAR's own site. I found no Devpost, DoraHacks or Encode listing, and there is no sign-up step. HACKATHON.md says it is the live version and that "dates and rules may change," so read it again before you submit.

## 1. Tracks, prizes and entering more than one track

### Takeaway
The claim checks out. There are 13 tracks. The prize pool is $250K, paid in NEAR: one $55K grand prize, plus $10K / $3K / $2K for 1st / 2nd / 3rd in each track. One submission can name as many tracks as it fits, and it is still one submission per team.

### Cited Findings
- Prize table: grand prize $55K ×1 = $55K. 1st place $10K ×13 = $130K. 2nd place $3K ×13 = $39K. 3rd place $2K ×13 = $26K. Total $250K. The site says "TOTAL PRIZE POOL (paid in NEAR)" and "One grand prize overall. 1st, 2nd and 3rd place in each of the 13 build tracks." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- Media describe it as "over $250,000" / "$250K+". The site's table adds up to exactly $250K. [MEDIA] — [Coinfomania, Oct 19](https://coinfomania.com/near-protocol-kicks-off-hackathon-with-250k-prize-pool/)
- The 13 tracks below give the API id, the track name and tagline, the "Build" text, and the organizers' hints. The hints are "what the organizers hope to see… hints and wishes, not requirements. Lean on the ones that fit the idea and name them in the README." [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md), [nearhackathon.com](https://nearhackathon.com)
  1. `defi`: **Unstoppable DeFi** ("Markets that never close"). Build exchanges, perps, lending, vaults and trading agents that settle across chains through NEAR Intents. "Deep liquidity, no custodian, nobody to switch it off." Hints: TRADING, NEAR INTENTS, CHAIN SIGNATURES.
  2. `thesis`: **Investment Thesis** ("Make the long-term case"). A long-term investment thesis for NEAR backed by data: onchain analytics, live dashboards and models anyone can re-run. "Judged on the evidence, not the conviction." Hints: ONCHAIN DATA, DASHBOARDS, RESEARCH.
  3. `privacy`: **Privacy & Private AI** ("Private by design"). Confidential computation, private finance, and AI that protects sensitive data. Hints: PRIVATE AI, TEE, NEAR AI CLOUD.
  4. `business`: **Autonomous Business** ("The company of one. Or none"). AI-native businesses with treasury, sales, procurement, cross-chain payments via NEAR Intents, and revenue sharing. "Humans only set the constraints." Hints: AI AGENTS, NEAR INTENTS, CHAIN SIGNATURES.
  5. `swarms`: **AI Swarms** ("Many agents. One economy"). Coordination markets, bidding, collective purchasing, intent-based settlement, and emergent economies between agents. Hints: MULTI-AGENT SYSTEMS, NEAR INTENTS, SUB-ACCOUNTS.
  6. `security`: **AI Security & Defense** ("Trust, but verify"). Spending limits, policy engines, sandboxed wallets, reputation, and scam detection. "Give AI money without giving it the keys to everything." Hints: AGENT SECURITY, FUNCTION CALL KEYS, TEE ATTESTATION.
  7. `agents`: **Agent Economy** ("Give AI a wallet"). Agents that earn, spend, negotiate, hire other agents, and pay for APIs, compute or data, with crypto directly or through NEAR Intents. Hints: AGENT COMMERCE, NEAR INTENTS, CHAIN SIGNATURES.
  8. `realworld`: **Real-World Money** ("Bring the boring money onchain"). Payroll, invoicing, remittances, merchant payments and stablecoin rails for real businesses. "Something a normal company could use tomorrow." Hints: STABLECOINS, NEAR INTENTS, META TRANSACTIONS.
  9. `games`: **Games With Real Economies** ("The economy is the gameplay"). NPCs with wallets, player-owned markets, and economies that evolve without a dev patch. "Judged on the game loop, not the token — bonus if players never notice the chain." Hints: AGENT NPCS, SOCIAL LOGIN, NEAR INTENTS, NEP-245.
  10. `nfts`: **NFTs That Do Something** ("What comes after the JPEG"). NFTs as accounts: assets that own money, earn royalties, hold inventory, or carry credentials, memberships or access rights. Hints: DYNAMIC NFTS, NEP-171, SUB-ACCOUNTS.
  11. `memecoins`: **Memecoins With Mechanics** ("The joke needs rules"). Supply that reacts to the community, treasuries with rules, onchain rituals and challenges. "Judged on the mechanic, not the chart." Hints: MEMECOINS, TOKEN MECHANICS, NEP-141.
  12. `social`: **Social Money** ("Coordinate value together"). Shared budgets, programmable rewards, collective ownership, and reputation-based access built on Sputnik DAO and Trezu. "Don't rebuild the multisig — build what communities do with it." Hints: SPUTNIK DAO, TREZU, NAMED ACCOUNTS.
  13. `open`: **Open Innovation** ("Something we haven't seen"). "Have an idea that refuses to fit a category?" Hints: EXPERIMENTAL, CHAIN ABSTRACTION, BUILD YOUR OWN.
- On multiple tracks, the FAQ says: "Can I build something across multiple tracks? Yes. Select every track your project fits in the submission form. It is still one submission per team." The API's `tracks` field takes "one or more" ids, "each listed once." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com), [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)

### Inferences
- Selecting several tracks appears to put the project in contention in each of them. Nothing says one project can win prizes in more than one track, and nothing forbids it.
- How the grand prize relates to track prizes is not stated, for example whether the grand-prize winner also keeps a track prize.
- A strong submission names several fitting tracks and names the hinted NEAR features in its README. HACKATHON.md says this outright.

### Gaps
- No rule found on whether one project can win more than one track prize, or both the grand prize and a track prize.
- Each prize is quoted in USD. I found no statement of the NEAR/USD rate used (for example, the rate at announcement or at payout).

## 2. Judges

### Takeaway
The claimed panel is correct and complete: 7 humans plus "Claude Code & Codex" as AI judges, 8 slots in total. Mert Mumtaz was added on Oct 15, when he joined the NEAR Foundation Council.

### Cited Findings
- The judges listed on the site, in order:
  1. Illia Polosukhin (NEAR Protocol, @ilblackdragon)
  2. Eddy Lazzarin (a16z crypto, @eddylazzarin)
  3. Mert Mumtaz (Helius, @0xMert_)
  4. Avichal Garg (Electric Capital, @avichal)
  5. Kain Warwick (Synthetix & Infinex, @kain)
  6. Haseeb Qureshi (Dragonfly, @hosseeb)
  7. Stepan Gershuni (cyber•Fund, @cyntro_py)
  8. "Claude Code & Codex" (Anthropic & OpenAI, @claudeai, @OpenAI)

  [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- The Oct 15, 2026 press release says Mert Mumtaz "joins the judging panel alongside Illia Polosukhin, Eddy Lazzarin, Avichal Garg, Kain Warwick, Haseeb Qureshi, and Stepan Gershuni, with Claude Code and Codex as AI judges." [PRESS] — [PR Newswire](https://www.prnewswire.com/news-releases/helius-ceo-mert-mumtaz-joins-the-near-foundation-council-302910012.html)

### Inferences
- Several of the human judges are investors (a16z, Dragonfly, Electric Capital, cyber•Fund), and the track copy keeps returning to real usage ("Something a normal company could use tomorrow"). Market and business viability probably counts alongside technical quality.

### Gaps
- No sponsor-specific judges or extra judges found.
- It is not stated which judges review which tracks, or how human and AI scores are combined.

## 3. Judging criteria, AI judging and what the README and demo need

### Takeaway
No official weighted rubric has been published. The site says only that earlier NEAR hackathons judged "technical implementation, design, impact, originality and sustainability." AI judging is confirmed: Claude Code and Codex are on the jury. Organizers tell entrants to write the README for machine readers too, with "do X - see Y" steps and "No marketing."

### Cited Findings
- From the FAQ: "Projects are reviewed by the jury above, with Claude Code & Codex joining as AI judges. Previous NEAR hackathons evaluated technical implementation, design, impact, originality and sustainability — a good guide to prepare by." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- HACKATHON.md says: "The jury includes AI judges, so write the README for a machine reader as well as a human one: what the product is, the problem it solves, and how to try it as 'do X - see Y' steps a judge can follow. No marketing." [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- Hints are not requirements: "Lean on the ones that fit the idea and name them in the README." [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- Some tracks state their own criterion. Thesis is "Judged on the evidence, not the conviction." Games is "Judged on the game loop, not the token — bonus if players never notice the chain." Memecoins is "Judged on the mechanic, not the chart." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- Execution plan on the site: "Four stages. One thing to show for it: something that works." Under "Build": "Turn your idea into a working prototype. Test the assumptions that matter." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- Advice from a media explainer, not official: the key test is whether reviewers who open your repo can reproduce the demo by following the instructions. "Preserve one complete workflow rather than five half-finished entry points." [MEDIA] — [AIPostHub, Oct 20](https://www.aiposthub.com/near-hackathon-ai-judges-2026/)

### Inferences
- AI judges will likely read the repo directly (README, code structure, perhaps running it). That rewards a clear README, steps that reproduce, working code for one core flow, and plain mentions of the NEAR features used, such as Intents, Chain Signatures and NEAR AI Cloud/TEE.
- The five stated criteria have no weights, so treat them as roughly equal.

### Gaps
- No weights, scoring scale or rubric published.
- It is not stated whether the AI judges run code, give scores or only shortlist, or how much their opinion counts.

## 4. Submission requirements and rules

### Takeaway
Confirmed rules:
- The deadline is Nov 14, 2026 at 23:59 UTC. The submission window is Nov 1 00:00 to Nov 14 23:59 UTC.
- Projects must be built during the hackathon.
- Required: a public repo, plus a public X post that says the project was built at NEAR HACKATHON with a demo video or screenshots attached.
- One submission per team, with no edits after submitting.
- Solo builders are allowed, and no sign-up is needed.

Not found on official sources:
- a 2-minute video limit (screenshots are an accepted alternative to video)
- a requirement to deploy to mainnet or testnet
- a written pre-existing-code policy beyond "Build your project during the hackathon"

### Cited Findings
- Timeline: start 2026-11-01T00:00:00Z. Development ends (the submission deadline) 2026-11-14T23:59:00Z. Judging starts 2026-11-16T00:00:00Z. Results announced by 2026-11-18T23:59:00Z. "All times are UTC. One submission per team." [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- Submissions are accepted only from Nov 1 00:00 to Nov 14 23:59 UTC. Outside that window the API returns 403. [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- Steps listed on the site:
  1. "Build your project during the hackathon"
  2. "Publish the repository. Judges can't open a private one"
  3. "Post your demo on X: say you built it at NEAR HACKATHON and attach the demo video or screenshots"
  4. "Submit the repository link and the link to your demo post. Both are required"

  [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- The repo may stay private while you build but "must be public by 2026-11-14T23:59:00Z." [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- No edits: "A submission cannot be edited, so send it when the repository is public and the demo post is up." Also: "A second submission with the same project name or email is rejected, so there is one attempt per team." A 409 response means the name or email is already used. [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- Form and API fields:
  - project name: 2–80 characters, unique, case-insensitive
  - team lead name: 2–80 characters
  - email: unique, at most 160 characters
  - team size: one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`
  - tracks: one or more ids
  - NEAR mainnet account for payout: a named account such as `team.near` or a 64-character implicit account
  - repo URL and demo-post URL: http(s), at most 300 characters each
  - "What did you build?": 20–2,000 characters covering "the problem, the product, and how NEAR fits in"
  - consent checkbox

  Body limit is 12,000 bytes. The hidden `website` field is a spam trap. You can submit through the form at nearhackathon.com/#apply or by POST to https://nearhackathon.com/api/applications. [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md), [nearhackathon.com](https://nearhackathon.com)
- Solo entry is fine: "No sign-up to start. Build with your team or solo, then submit once…" The form's team-size option reads "1 — Solo builder." The FAQ adds: "Do I need a team already? No." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- No wallet connection is needed to submit. You only enter a NEAR account address. [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- "What should we submit? A working prototype in a public repository and a public demo post on X…" [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- On mainnet vs testnet: the only mention of mainnet in official sources is the payout account, which must be a mainnet NEAR account. HACKATHON.md tells agents never to "deploy to mainnet" without the human's confirmation. That is a safety rule, not a requirement. [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)

### Inferences
- The claimed 2-minute demo video does not appear on any official source. The official requirement is "demo video or screenshots" attached to an X post. Native X video length limits for non-Premium accounts (about 2:20) may be where "2 min" came from. Keeping it short is wise, but it is not a rule.
- "Build your project during the hackathon" suggests new work is expected. A safer approach is to start a fresh repo on or after Nov 1. Using existing libraries and SDKs is normal.
- Since there is one attempt per team, check everything before you submit: repo public, README finished, X post live.

### Gaps
- No video length limit found in official sources.
- No mainnet or testnet deployment requirement found either way.
- No explicit pre-existing-code or prior-work policy, and no IP/licensing or open-source licence requirement.
- No terms-and-conditions page. /terms, /rules and /faq all return 404. The only rules are the homepage FAQ and HACKATHON.md.
- Unclear whether commits to the repo after the deadline are allowed or count against you.

## 5. Eligibility (India), KYC and prize payout

### Takeaway
The official site lists no country restrictions, no KYC and no age limits. "Developers, designers and people with ideas for the NEAR ecosystem" can take part. Prizes are paid in NEAR tokens to the NEAR mainnet account given at submission, not in USDC. Nothing official mentions India specifically.

### Cited Findings
- From the FAQ: "Who can take part? Developers, designers and people with ideas for the NEAR ecosystem. No wallet connection is needed to submit: you only enter a NEAR account address, and if you win, the prize is sent there." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- The prize pool is "paid in NEAR." The form says: "Your own wallet or your team's. If you win, the prize is sent here." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- The payout account must be a mainnet named or implicit account that the team creates in any NEAR wallet. [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- Media confirm "$250,000 USD (paid in NEAR tokens)." [MEDIA] — [AIPostHub](https://www.aiposthub.com/near-hackathon-ai-judges-2026/)

### Inferences
- Nothing published excludes India-based participants. Big crypto prize programs often add KYC or sanctions checks before paying out, even when they don't announce them, so be ready for possible identity verification. That expectation comes from general practice, not from any NEAR statement.
- Tax and receipt are your own matter. In India, crypto received as a prize is generally taxable. That is general knowledge, not from these sources.

### Gaps
- No KYC, sanctions, age or jurisdiction rules found.
- No payout timeline, and no NEAR/USD conversion method.

## 6. Illia's stated themes and his Oct 3, 2026 list of 13 app ideas

### Takeaway
The "cross-chain markets and confidential AI" framing comes from NEAR's own messaging around the hackathon: "A market of markets" and "confidentiality as a core primitive." Illia's Oct 3, 2026 X post with 13 app ideas is real. I could only find media paraphrases of it, not the verbatim post text. That post was not framed as a hackathon announcement.

### Cited Findings
- From the Oct 15, 2026 NEAR Foundation press release, which announced the hackathon as "a two-week build sprint on NEAR's stack, including NEAR Intents and NEAR AI Cloud": "For crypto to win, we need connected, unstoppable liquidity at planetary scale. A market of markets." Also: "NEAR is building where markets across every chain meet, for people and AI agents alike, with confidentiality as a core primitive." And: "NEAR Intents has processed more than $33 billion in all-time volume, with confidential TVL now over $160 million." [PRESS] — [PR Newswire](https://www.prnewswire.com/news-releases/helius-ceo-mert-mumtaz-joins-the-near-foundation-council-302910012.html)
- Media summarize the focus areas as cross-chain development and markets, agentic applications with confidentiality, and confidentiality as a core primitive. [MEDIA] — [Coinfomania, Oct 19](https://coinfomania.com/near-hackathon-launches-with-judging-panel-from-a16z/)
- Illia's 13 app ideas come from his X post of Oct 3, 2026, as reported by crypto.news (Lawrence Mondal, Oct 3, 2026 08:04 UTC). These are media paraphrases, not his verbatim text. The capitalised names are crypto.news's labels. [MEDIA] — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)
  1. **AI Tamagochi**: NFT-based characters that hold NEAR balances to pay for AI inference. Feeding and dressing, possibly battle arenas and competitions.
  2. **AI Encyclopedia**: facts become ongoing prediction markets (Augur model). AI generates pages from market assessments instead of community editing.
  3. **AI Model Benchmarking**: test models against private datasets without exposing them. Results are certified and tied to the model's identity and a hash of the test set.
  4. **Universal Checkout Widget**: merchants accept NEAR Intents payments from whatever wallet or chain the customer already uses. Distribution target: Shopify.
  5. **Event Registration System**: attendee deposits held in escrow until check-in, with no-shows' funds split among attendees. This extends the Kickback model across chains and assets.
  6. **OTC Counterparty Marketplace**: today's "private deals" feature only works if you already know your counterparty. A marketplace would let people post deals for others to fill via NEAR Intents.
  7. **Social Trading with Viewing Keys**: traders sell viewing keys that open their private transactions to followers, while P&L stays public.
  8. **Never Get Liquidated**: NEAR Intents manages lending and perp positions, earning yield while managing liquidation risk.
  9. **Delta Neutral Anything**: spot holdings paired with perps under a NEAR contract that runs the transactions through Intents.
  10. **Private Code Review Agent**: reviews private pull requests through NEAR AI with verifiable execution.
  11. **Private Medical Second Opinion**: end-to-end encrypted medical data goes to NEAR AI for analysis. Crypto and fiat payments, with custom prompts stored as NFTs.
  12. **Private Transcription App**: Granola-like. NEAR AI transcribes while records stay local with encrypted backups. Could be funded by NEAR staking instead of a subscription.
  13. **Cap Table Tool**: for companies raising money, with fundraising instruments, crypto payment acceptance and banking support.
- In the same post, Illia gave 5 distribution suggestions [MEDIA] — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/):
  1. Aurora wallet connections via Intent Connect, for cross-chain use without bridging
  2. the NEARLegion community
  3. cross-promotion through other communities
  4. Product Hunt
  5. X
- Illia quote, via crypto.news: "Building itself got easier too, so it's really about what to build and how stand out to get distribution." [MEDIA] — [crypto.news](https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/)

### Inferences
- Many of the 13 ideas map straight onto tracks. Ideas 6–9 fit `defi`. Ideas 3 and 10–12 fit `privacy`. Idea 4 fits `realworld`. Idea 1 fits `nfts`/`games`. Idea 5 fits `realworld`/`social`. Idea 2 fits `open`/`agents`. Idea 13 fits `realworld`/`business`. A head judge's own ideas, built well, are probably well received. Other entrants will likely build the same things, though.
- The repeated emphasis on Intents and confidentiality suggests that NEAR Intents (including Confidential Intents) and NEAR AI Cloud TEE are the "house" technologies that judges want to see used.

### Gaps
- The verbatim text of Illia's Oct 3 X post could not be retrieved. X is not fetchable, and no source quotes it in full.
- No official hackathon text uses the exact phrase "cross-chain markets and confidential AI." It is a fair paraphrase of the press release language.

## 7. Official resources, workshops, Discord and sponsor bounties

### Takeaway
Official resources:
- NEAR docs
- NEAR Discord
- @NEARProtocol on X
- a downloadable HACKATHON.md for AI coding agents, which can also file the submission through the API
- a 12-partner ecosystem list with docs links

I found no workshops, no office hours and no separate sponsor bounties or prizes.

### Cited Findings
- Builder toolkit: "Read the Docs" (https://docs.near.org/). "Hand HACKATHON.md to your coding agent. It knows the tracks, the dates and the submission steps, and can file your submission." [OFFICIAL] — [nearhackathon.com](https://nearhackathon.com)
- Community: the NEAR Discord (https://discord.gg/nearprotocol) is for questions and finding teammates. X (https://x.com/NEARProtocol) carries announcements and updates. [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- Ecosystem partners, with docs links from the site [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md):
  - NEAR Intents, cross-chain execution: docs.near-intents.org, github.com/near/intents
  - Aurora, Ethereum on NEAR: doc.aurora.dev
  - HOT, chain abstraction: docs.hotdao.ai
  - Rhea, DeFi on NEAR: guide.rhea.finance
  - meme.cooking, memecoin launchpad
  - HEX, cross-chain swaps: hex.exchange
  - NEAR.AI, private AI: docs.near.ai, github.com/nearai/cloud-api
  - SVRN, sovereign technology: svrn.net
  - Trezu, multisig treasury: github.com/NEAR-DevHub/trezu-docs
  - SputnikDAO, DAO infrastructure: github.com/near-daos/sputnik-dao-contract
  - OutLayer, secure transactions for AI agents: app.outlayer.ai/docs/getting-started
  - GoMining, Bitcoin mining superapp: docs.gomining.com
- HACKATHON.md also warns: "Read the docs before integrating anything; verify endpoints, contract addresses and SDK versions there instead of assuming them." [OFFICIAL] — [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- These are separate earlier or ongoing NEAR events, not this hackathon:
  - The NEAR AI agent monthly hackathons (180 NEAR per month; Best MCP Tool, etc.) appear in market.near.ai job listings.
  - Older events such as MetaBUILD (HeroX) and the [REDACTED] hackathon (Bangkok, Nov 2024) also turn up in searches.

  Do not confuse them with this event. [MEDIA/other] — [market.near.ai](https://market.near.ai/jobs/23606390-237c-479a-9f79-a111a4f7113c), [HeroX MetaBUILD](https://www.herox.com/NEARMetaBUILD), [[REDACTED] FAQ](https://aquamarine-coelurus-f91.notion.site/REDACTED-FAQ-12a99a15f25980fab8d1c751bb0c8734)

### Inferences
- The partners are probably the integrations judges hope to see, for example OutLayer for `security`/`agents`, Trezu/SputnikDAO for `social`, meme.cooking for `memecoins`, and Rhea/HEX for `defi`. None of them has announced a separate bounty.

### Gaps
- No workshops, office hours, AMA schedule or kickoff stream found as of Oct 22. These may be announced on @NEARProtocol or Discord after Nov 1.
- No sponsor-specific bounties found.
