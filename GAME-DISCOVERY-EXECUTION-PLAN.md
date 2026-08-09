# Master Casual Gaming App — Game Discovery & Execution Plan
*Research window: Q1 2025 – Q1 2026. Data verified against Sensor Tower State of Gaming 2026, AppMagic H1/Q1 2025 casual & hybrid-casual reports, Sensor Tower India Insights 2025, PocketGamer.biz/AppMagic 2025 download charts, and Tetris Holding v. Xio (D.N.J. 2012) for the IP framework.*

---

## Part 1 — What the market data actually says (verified findings)

1. **Downloads are shrinking, attention is not.** Global mobile game downloads fell ~7.2% in 2025 (~50.4B) while IAP revenue held (~$82B). Hypercasual was the **only** monetization model with download growth, and time spent on hypercasual surged globally. Simple, high-retention formats are winning attention even as installs tighten. (Sensor Tower, high confidence)
2. **Hybrid-casual puzzle is the breakout cluster of 2025–26.** Block Puzzle revenue ~12× YoY, Screw Puzzle ~2.8×, Sort Puzzle ~2.2× (H1 2025). Top-10 hybrid-casual games did $87M net IAP in Q1 2025 (+67% YoY); Puzzle took 48% of that (Block Puzzle alone 71% of the puzzle share). Titles like Color Block Jam, Screwdom, Magic Sort, All in Hole entered the top-50 grossing. (AppMagic + GameRefinery, high confidence)
3. **Block puzzle is the #1 download format on Earth.** Block Blast!: 356.2M downloads in 2025, still #1 in Feb 2026 — ahead of Roblox, Free Fire, Subway Surfers. Tile-match did 502.9M downloads (+28%); mahjong solitaire 258.3M (+189% YoY). (AppMagic/Sensor Tower, high confidence)
4. **The winning playbook** (Color Block Jam $25M/quarter; All in Hole $17.7M/quarter): generic mechanic + deterministic hand-designed levels + difficulty spike around level 20–25 that sells boosters + staged ad rollout (ad-free early levels) + 3–5 minute sessions + clip-friendly visuals. No complex LiveOps needed. (Medium-high confidence; note: paid UA also contributed.)
5. **Casual IAP is concentrated in puzzle.** Of ~$12B H1 2025 casual net IAP, 80% sits in Puzzle + Casino + Simulation. Puzzle ($4.6B, +13%) is the only genre with both top downloads AND top IAP. (AppMagic, high confidence)
6. **Io-style "eat & grow" is revived and cheap to build.** Hole.io: record 119.1M downloads in 2025 after adding level progression. Its "multiplayer" is largely bots — which removes netcode complexity for a rebuild. (High/medium confidence)
7. **Merge-2 grows fastest (+94% revenue YoY) but is a trap for entrants** — none of 91 new H1 2025 titles hit $100K/month. Only a lightweight merge mini-game makes sense for us. (High confidence)
8. **Plinko/ball-drop is exploding in India specifically** (36× revenue growth, 65M installs H1 2025) but is ad-dependent, low-retention, and casino-adjacent — regulatory sensitivity in India post-2025 gaming law. (High confidence, handle with care)
9. **India = volume market.** World's largest by downloads (8.45B installs FY24-25), only ~$400M IAP. Downloads: Simulation ~22%, Arcade/runner ~19%, Puzzle ~16%. Casual formats monetize primarily via **ads**, with IAP trending up (~10% YoY). Design for hybrid from day one, ads-forward in India. (Sensor Tower, high confidence)
10. **Monetization norm is hybrid IAA+IAP:** puzzle subgenres run ≈59% IAP / 41% ads; competitive formats skew to ~72–82% IAP. Target ≈60/40 for our puzzle games. (Sensor Tower, high confidence)
11. **India regulatory note:** the 2025 online gaming legislation banned real-money gaming; India's market still grew 17% after the ban (Lumikai). **Do not build real-money entry fees for India.** Tournaments must be free-entry / virtual-coin economy.

**The legal frame (Tetris Holding v. Xio, D.N.J. 2012):** game *rules and mechanics* are unprotectable ideas; *expression* is protected — art style, characters, names, trade dress, exact visual dimensions/arrangement, animations, music, level data, and overall "look and feel." Xio lost because it copied Tetris's look (grid proportions, piece styling, colors), not because it made a falling-block game. **Our rule: take the verb, never the skin.** Every game below follows that line.

---

## Part 2 — The game portfolio (10 concepts, full analysis)

Scoring key: composite of attention (verified demand), dev ease, originality headroom, monetization, retention, IP safety.

### GAME 1 — Grid-Fit Puzzle (working title: "Peti Puzzle" / "BlockBazi") — **Priority 9.5/10**
1. **Concept:** Drag pre-shaped pieces onto an 8×8-style board; clear full rows/columns; game over when nothing fits. Endless score mode + a level mode with goals.
2. **Why it's hot:** #1 downloaded game format in the world (356M installs for the category leader in 2025 alone); 12× YoY revenue growth in hybrid-casual block puzzle. Perfect "one more round" loop: 60–120s rounds, near-miss tension, visible board state.
3. **IP risk check:** Falling/fitting-block mechanics are unprotectable (Tetris v. Xio). **Must avoid:** Block Blast's exact color palette/glow style, its piece shapes-plus-styling combo, its name, its sound cues, and Tetris trade dress (7 tetromino styling, 10×20 well).
4. **Originality:** Use a **9×9 board with a 3×3 "bonus zone" system** (clear the zone for combo multipliers — also gives it a Sudoku-grid familiarity for India). Theme: Indian truck-art / festival-crate aesthetic, or clean "gem cut" look. Add a daily hand-designed puzzle (Wordle-style shared seed) — nobody in the block space owns that habit loop.
5. **Build:** Phaser 3 (HTML5) module in the shell. Pure grid logic: 2D array, piece-fit check, line-clear scan, greedy solvability checker for piece generation. Difficulty scaling = piece-bag weighting (more awkward pieces as score rises). Single-player. **Complexity: LOW — 2–3 weeks.**
6. **Assets:** 12–15 piece sprites, board frame, 3 background themes, clear/combo particle FX, 8–10 SFX (place, clear, combo, fail), 1 music loop, score UI, booster icons (hammer, rotate, swap).
7. **Sourcing:** Geometry = original vector work (Figma/Illustrator); particles via Phaser built-ins; SFX from ZapSplat/Freesound (CC0) or custom in sfxr; music from royalty-free libraries (Pixabay Music, Uppbeat) or commissioned loop (~$100–300 on Fiverr).
8. **Monetization:** Interstitial after every 2–3 games (staged: none for first 10 rounds), rewarded video for "continue" and boosters, coin-purchased boosters (the proven revenue driver), remove-ads IAP ₹199/$2.99. Target 60/40 IAP/ads globally, ads-forward in India.
9. **Retention:** Daily puzzle streak, personal best chase, weekly leaderboard league, piece-skin collectibles, "perfect clear" achievements.
10. **Shortlist tags:** Quick MVP ✅ · High retention ✅ · High monetization ✅ · Low IP risk ✅

### GAME 2 — Color Sort Puzzle ("Rang Sort") — **Priority 9/10**
1. **Concept:** Tap to pour colored items between containers until each holds one color. Hand-designed levels, limited empty slots.
2. **Why:** Sort Puzzle revenue +2.2× YoY; the sort mechanic is one of the most-cloned because it's hypnotic, ASMR-adjacent, and clip-friendly. Deterministic levels → sellable difficulty spikes (the Color Block Jam playbook).
3. **IP risk:** Sorting-by-color is a pure mechanic — free to use. **Avoid:** Water Sort Puzzle's glass-tube visual identity, Magic Sort's presentation, any specific level data copied from competitors.
4. **Originality:** Sort **spices into tins / bangles onto stands / marigolds into garlands** (instantly Indian, zero competitors own it; global skin: gems into chests). Twist mechanic: a "masala mix" wildcard item and locked lids that open on combo — creates original puzzle grammar.
5. **Build:** Phaser 3. Logic: stacks + pour rules + a level generator with reverse-solver to guarantee solvability, then hand-tune difficulty curve (spike ~level 20 per the verified playbook). Single-player. **Complexity: LOW — 2 weeks.**
6. **Assets:** Container set ×3 themes, 8–12 item colors, pour animation, sparkle FX, level-complete screen, 6 SFX, 1 loop.
7. **Sourcing:** Original vectors; pour physics is tweened (no physics engine needed); audio as Game 1.
8. **Monetization:** Booster IAP (undo, extra container, skip), rewarded "extra slot," interstitials between levels. Boosters here monetize better than in endless formats because failure is level-specific.
9. **Retention:** Level map with chapters (Indian cities theme), 3-star system, daily challenge level, seasonal event levels (Diwali/Holi skins).
10. **Tags:** Quick MVP ✅ · High monetization ✅ · Low IP risk ✅

### GAME 3 — Tile Triple-Match ("Tila Match") — **Priority 8.5/10**
1. **Concept:** Layered stacks of tiles; tap tiles into a 7-slot tray; three identical tiles clear. Clear the board without filling the tray.
2. **Why:** Mahjong-solitaire/tile-match was 2025's fastest-surging download category (+189% YoY, 258M installs; Vita Mahjong #7 globally). Older/female-skewing audience with long sessions — a demographic most mini-game apps ignore.
3. **IP risk:** The triple-match tray mechanic (Tile Master/Triple Match style) is generic; classic mahjong tiles are ancient/public domain. **Avoid:** Vita Mahjong's specific tile art, "Tile Master" style names, competitors' layer layouts copied verbatim.
4. **Originality:** Tile faces = **Indian motifs** (rickshaws, chai glasses, cricket bats, rangoli) with a global set (fruits, gems). Twist: a "bazaar" mechanic — one reshuffle stall per level that trades tray tiles. Larger fonts/tiles as an accessibility flag for the 40+ audience.
5. **Build:** Phaser 3. Logic: layered board (z-order + overlap masking), tray state machine, solvability-aware dealing. Difficulty = layer count + tile-type count. Single-player. **Complexity: LOW-MEDIUM — 3 weeks.**
6. **Assets:** 30–40 tile face icons ×2 themes, tile back/frame, board backgrounds, tray UI, match FX, 8 SFX, calm music loop.
7. **Sourcing:** Tile icons are the main cost — commission one icon set (~$300–600) or build from CC0 icon libraries (Kenney, OpenMoji-derived originals redrawn).
8. **Monetization:** Rewarded video (undo, tray+1, shuffle), booster IAP, interstitials. Category shows huge installs but weaker IAP — run it ads-forward.
9. **Retention:** Chapter map, daily quests ("clear 3 boards"), collection album of rare golden tiles.
10. **Tags:** Quick MVP ✅ · High retention ✅ · Low IP risk ✅

### GAME 4 — Board Race / Ludo-style ("Chaupar Champs") — **Priority 8.5/10**
1. **Concept:** 2–4 players race 4 tokens around a cross-board by dice roll; capture opponents; first home wins. Classic Pachisi rules with speed variants.
2. **Why:** Ludo is India's default social game (Ludo King built a 100M+ MAU business on it); board games are the social glue of Indian multi-game platforms (WinZO/Zupee model). Post-RMG-ban, free social play is exactly where Indian engagement moved (market +17% after the ban).
3. **IP risk:** **Lowest possible** — Pachisi/Ludo is a centuries-old public-domain game. **Avoid:** "Ludo King" name/logo/board art, Zupee's trade dress. The generic word "ludo" is risky in branding given aggressive trademark holders — use our own name.
4. **Originality:** "Chaupar" heritage framing (the *original* Indian game — a story competitors don't tell), original board art, **power-tile variant mode** (shortcut squares, shield tiles), 2-minute "quick race" mode with 2 tokens for short sessions.
5. **Build:** The one true multiplayer title in wave 1: build **pass-and-play + smart bots first** (zero netcode), then async/real-time via a lightweight server (Colyseus or Firebase Realtime DB — turn-based tolerance makes this easy). Dice logic must be provably fair (seeded RNG, server-authoritative online). **Complexity: MEDIUM — 4–6 weeks incl. online.**
6. **Assets:** Board ×3 skins, 4 token sets, dice + roll animation, capture/home FX, avatar frames, emotes (6–8), win screen, 10 SFX, 2 loops.
7. **Sourcing:** Original board illustration is worth commissioning (~$300–800) — it's the face of the game; emotes/avatars in-house vector style.
8. **Monetization:** Highest IAP ceiling in the portfolio: token/board/dice skins, emotes, entry to **coin tournaments (virtual currency only in India)**, season pass. Competitive formats support ~70/30+ IAP-heavy splits.
9. **Retention:** THE social/viral engine — invite links ("beat me"), friend leaderboards, referral coins, daily win missions, seasonal boards.
10. **Tags:** High retention ✅ · High monetization ✅ · Low IP risk ✅✅ · Viral/social ✅✅

### GAME 5 — Eat & Grow Arena ("Bhukkad" / "Nom City") — **Priority 8/10**
1. **Concept:** Control a growing hole/creature that swallows objects smaller than itself in a timed arena; grow to swallow bigger things; goal-driven 3–5 minute levels plus arena-vs-bots mode.
2. **Why:** Hole.io hit a record 119M downloads in 2025; All in Hole did $17.7M in Q1 2025 and grew its subgenre 9× by adding goals, battle pass, events. Verified: leaders use **bots**, not real netcode — cheap to replicate.
3. **IP risk:** "Consume smaller things to grow" is a generic mechanic (agar.io → Hole.io lineage). **Avoid:** Hole.io's city art style, its name pattern, Donut County's narrative expression.
4. **Originality:** Theme it as a **street-food-devouring creature in an Indian bazaar** (swallow samosas → carts → buses) or a global "black-hole pet." Goal-driven levels (per the All in Hole playbook) instead of pure deathmatch, plus daily "feeding frenzy" event.
5. **Build:** Phaser 3 + Matter.js (or plain circle-overlap math — sufficient). Bots = simple seek-food/flee-bigger steering AI. Camera zoom-out as you grow is the key juice. **Complexity: MEDIUM — 4 weeks.**
6. **Assets:** 1 hero creature with 4 growth stages, ~40 swallowable object sprites per theme, arena map ×2, bot skins ×8, swallow/grow FX, 10 SFX, energetic loop.
7. **Sourcery:** Kenney CC0 city/object packs as greybox, replaced with commissioned bazaar set; creature = our first mascot (see design language).
8. **Monetization:** Skin economy (creatures/trails), rewarded "2× growth" starts, battle-pass tier when scaled. Arcade formats in India = ads-forward.
9. **Retention:** Growth-stage collection, arena rank ladder vs bots, clip-worthy "swallowed a whole bus" moments for shares.
10. **Tags:** Viral/social ✅✅ · High retention ✅

### GAME 6 — Unscrew Puzzle ("Khol Do!") — **Priority 7.5/10**
1. **Concept:** Remove bolts/pins in the right order so plates fall free; wrong order = jams. Physics-lite spatial reasoning.
2. **Why:** Screw Puzzle revenue ×2.8 YoY (H1 2025); Screwdom in top-50 grossing. Satisfying "release" dopamine, deterministic levels → booster sales.
3. **IP risk:** Unscrew/pin-pull mechanics are generic (whole subgenre exists). **Avoid:** Screwdom's board art/name family, Screw Jam's presentation.
4. **Originality:** Theme: **dismantling quirky jugaad machines** (a design language competitors lack); story beats between chapters ("free the scooter!"). Wildcard tool mechanic: one magnet per level pulls any bolt.
5. **Build:** Phaser + Matter.js constraints (bolts = revolute joints; removal frees bodies). Level editor is the real work — build an internal JSON editor early. **Complexity: MEDIUM — 4–5 weeks.**
6. **Assets:** Plate/bolt sprite kit, 5 machine themes, physics-fall FX, toolbox UI, 8 SFX, workshop loop.
7. **Sourcing:** Vector kit in-house; physics via Matter.js (MIT).
8. **Monetization:** Strong booster IAP (extra slot, magnet, undo) + interstitials — this subgenre's verified strength.
9. **Retention:** Chapter machines, daily bolt challenge, mastery stars.
10. **Tags:** High monetization ✅

### GAME 7 — Endless Runner ("Local Dash") — **Priority 7/10**
1. **Concept:** Auto-run, swipe lanes/jump/slide through obstacles, collect coins, distance = score.
2. **Why:** Arcade/runner ≈19% of ALL Indian downloads (2nd-largest category); Subway Surfers still top-5 downloaded globally a decade in. Evergreen, not trendy — a reliable engagement anchor.
3. **IP risk:** Lane-running is generic. **Avoid:** Subway Surfers' characters/graffiti trade dress, Temple Run's specific presentation.
4. **Originality:** Run through **Indian streetscapes** — dodge autos, cows, chai stalls; power-up = "cutting chai" speed boost. Global skin: neon sci-fi. Character roster = our own mascots (cross-game IP building).
5. **Build:** The heaviest wave-1 build: 3-lane segment-pool system, swipe input, chunk-based procedural track, speed-ramp difficulty. Phaser handles it in 2.5D; consider Unity only if we want full 3D. **Complexity: MEDIUM-HIGH — 6 weeks (2.5D).**
6. **Assets:** Biggest list: 2–3 characters ×4 animations, 15+ obstacle types, parallax street layers, coins/power-ups, crash FX, 12 SFX, high-energy loop.
7. **Sourcing:** Character animation via commissioned sprite sheets or Spine; greybox with Kenney packs first.
8. **Monetization:** Rewarded revive (proven top earner in runners), character/board skins, coin doubler IAP.
9. **Retention:** Daily distance missions, character collection, weekly city-themed events.
10. **Tags:** High retention ✅ · Viral/social ✅ (India-relatable clips)

### GAME 8 — Trivia Battles ("Dimaag Ki Batti") — **Priority 7/10**
1. **Concept:** 10-question rapid quiz rounds — solo streaks or async 1v1 (opponent's recorded run). Categories: cricket, Bollywood, general knowledge, global pop.
2. **Why:** Trivia is an evergreen social format and India's quiz culture (KBC) is deep; async battle needs no real-time netcode. (Note: community-trend evidence here was a research gap — this pick is strategic inference from India platform patterns, flagged honestly.)
3. **IP risk:** Facts aren't copyrightable, but **question compilations are** — never scrape question banks (KBC/Trivia Crack). Write/generate original questions and avoid their wheel/character trade dress.
4. **Originality:** "Batti" (lightbulb) lifeline economy; regional-language question packs (Hindi first) — a real moat; weekly cricket-match-tied topical quizzes.
5. **Build:** Simplest of all: JSON question bank + timer UI. LLM-assisted question generation with human review pipeline. Async battles via Firebase. **Complexity: VERY LOW — 1–2 weeks.**
6. **Assets:** Category icons, timer/streak UI, right/wrong FX, host-mascot character, 6 SFX, quiz-show sting.
7. **Sourcing:** Questions = original authored/LLM-generated + human-verified; UI in-house.
8. **Monetization:** Rewarded lifelines, category-pack unlocks, coin wagers (virtual only).
9. **Retention:** Daily quiz (shared seed, shareable score card — the Wordle loop), streaks, topical events.
10. **Tags:** Quick MVP ✅ · Viral/social ✅ · Low IP risk ✅

### GAME 9 — Lightweight Merge ("Jodi Merge") — **Priority 6.5/10**
1. **Concept:** Drag two identical items to merge into a higher-tier item on a small board; fill orders to clear space. Sessionized (no energy walls initially).
2. **Why:** Merge-2 = fastest-growing casual format (+94% revenue YoY, RPD $4.7) — but verified evidence says new full-meta entrants fail. So: capture the mechanic's pull as a mini-game, skip the complex meta.
3. **IP risk:** Merging is generic. **Avoid:** Merge Dragons/Gossip Harbor art, story, and item-chain expression.
4. **Originality:** Merge chains themed on **Indian wedding prep** (bangles→sets→trousseau) or street market goods; "order thali" completion mechanic.
5. **Build:** Grid + drag-drop + merge-chain data tables. **Complexity: LOW — 2–3 weeks.**
6. **Assets:** 6 merge chains × 6 tiers of item icons (~36 icons/theme), board, order UI, merge-pop FX.
7. **Sourcing:** Icon-heavy — same pipeline as Game 3.
8. **Monetization:** This is the portfolio's IAP-depth card: board expansion, instant-finish, item bubbles.
9. **Retention:** Longest natural progression tail; daily orders, collection book.
10. **Tags:** High retention ✅ · High monetization ✅

### GAME 10 — Ball Drop Board ("Tikki Drop") — **Priority 5.5/10 (conditional)**
1. **Concept:** Drop balls through a peg board into multiplier slots; physics chaos, satisfying cascades. **Skill-framed** (aim + peg layout puzzles), explicitly NOT gambling-framed.
2. **Why:** Plinko-style = fastest-growing subgenre targeting India (36× revenue, 65M installs H1 2025). But verified caveats: low retention, ad-dependent, casino-adjacent.
3. **IP risk:** Peg-board physics is generic (pachinko is ancient). The real risk is **regulatory, not copyright**: India's 2025 law bans real-money gaming, and casino-styled presentation risks store policy flags.
4. **Originality:** De-casino it entirely: **carnival "gilli" stall** theme, level-based objectives (light all pegs), zero currency-multiplier framing.
5. **Build:** Matter.js physics, trivially simple. **Complexity: VERY LOW — 1 week.** Ship as an engagement/ad-inventory game, not a pillar.
6. **Assets:** Pegs, balls, board frames, cascade FX, 5 SFX.
7. **Sourcing:** All in-house vector; physics MIT-licensed.
8. **Monetization:** Ads-forward (rewarded extra balls). Don't attach coin-multiplier economies in India.
9. **Retention:** Low — daily drop bonus only. Accept it.
10. **Tags:** Quick MVP ✅ (with regulatory framing done right)

**Bench (wave 3+):** slide-merge 2048-style numbers game (open-source-origin mechanic, very low risk, 1 week build); regional-language word game (big moat, but our research had no verified word-game demand data — validate first); carrom-style flick game (India-native, public domain).

---

## Part 3 — Ranked shortlists

**Build-first ranking (composite):**
1. Grid-Fit Puzzle (9.5) → 2. Color Sort (9) → 3. Tile Triple-Match (8.5) → 4. Board Race (8.5) → 5. Eat & Grow (8) → 6. Unscrew (7.5) → 7. Runner (7) → 8. Trivia (7) → 9. Merge (6.5) → 10. Ball Drop (5.5)

| Category | Games (in order) |
|---|---|
| **Quick MVP (wave 1, weeks 1–8)** | Grid-Fit Puzzle, Color Sort, Trivia, Ball Drop, Tile Triple-Match |
| **High retention** | Board Race, Grid-Fit Puzzle, Merge, Tile Triple-Match, Runner |
| **High monetization** | Grid-Fit Puzzle, Board Race, Unscrew, Merge, Color Sort |
| **Lowest copyright risk** | Board Race (public domain), Trivia (original bank), Tile Triple-Match, Grid-Fit, Color Sort |
| **Viral/social potential** | Board Race (invites), Eat & Grow (clips), Trivia (daily share cards), Runner, Color Sort (ASMR clips) |

**Recommended launch sequence:**
- **Wave 1 (MVP, ~8 weeks):** App shell + Grid-Fit + Color Sort + Trivia. Three games, all LOW complexity, covering puzzle depth + social sharing + daily habit. Ship to Play Store.
- **Wave 2 (weeks 9–16):** Tile Triple-Match, Board Race (with bots → online), Ball Drop. Adds the demographic-expanding tile game and the social anchor.
- **Wave 3 (weeks 17–26):** Eat & Grow, Unscrew, Merge, Runner. Adds monetization depth and clip-driven acquisition.

---

## Part 4 — Technical architecture (one platform, many games)

- **Shell app:** Flutter (single codebase, Android first, iOS later). Owns: login (Firebase Auth, phone/Google), coin wallet, profile, leaderboards, daily rewards, ad mediation, IAP, analytics, game launcher.
- **Games:** Phaser 3 (HTML5/TypeScript) bundles rendered in an embedded WebView, loaded from CDN with local caching. **Why:** ship/update/AB-test games without app releases (the WinZO/MPL model), tiny bundle sizes for India's storage-sensitive users, one skillset across all 10 games. (Unity only if we later commit to 3D.)
- **JS↔native bridge SDK (build once):** `getUser() / addCoins() / spendCoins() / showRewardedAd() / showInterstitial() / submitScore() / logEvent()`. Every game speaks only this API — games stay decoupled and testable in a browser.
- **Backend:** Firebase (Auth, Firestore for wallet/leaderboards, Remote Config for difficulty/ad-frequency tuning, Cloud Functions for anti-cheat score validation). Add Colyseus/Nakama on a VM only when real-time multiplayer ships (Board Race wave 2).
- **Difficulty scaling pattern (all puzzle games):** deterministic hand-tuned level curves with a spike around level 20–25 (the verified booster-selling curve), controlled via Remote Config so tuning never needs a release.
- **Multiplayer strategy:** bots first (Eat & Grow, Board Race), async second (Trivia, leaderboard duels), real-time last (Board Race online). This sequencing is directly supported by the finding that category leaders fake multiplayer with bots.
- **Ads:** AppLovin MAX or Google AdMob mediation; staged introduction per the verified playbook (no interstitials in first sessions); banner-free inside gameplay.

---

## Part 5 — Unified design language ("one app, one family")

- **Brand feel:** "Modern mela" — playful Indian carnival energy with international polish. Warm, saturated, rounded, tactile. Never casino-styled.
- **Palette:** Deep indigo base (#2D2A5E) + saffron/marigold primary (#FF9F1C) + festive pink (#EF476F) + teal (#06D6A0) + cream surfaces (#FFF8EC). Dark-mode-first shell; each game picks 2 accents from this fixed palette so screenshots always look like one family.
- **Typography:** Baloo 2 (display — rounded, Devanagari support) + Nunito Sans (UI). Both Google Fonts, free, multilingual — critical for Hindi/regional localization.
- **UI style:** Soft-rounded cards (24px radius), thick 3px outlines, candy-drop buttons with bottom shadow, confetti micro-bursts on wins. All buttons squash-and-stretch on tap (one shared animation spec).
- **Character system:** One mascot family — e.g., "the Chhotu crew," 4–5 rounded critters (a hungry blob, a wise owl quiz-host, a speedy squirrel runner) reused across games as hosts/skins. This builds ownable IP where competitors have none.
- **Reward/win screens:** identical template across all games — burst animation, coin count-up with sound, streak flame, one share button. Consistency here is what makes 10 games feel like one product.
- **Sound identity:** one 3-note brand sting on app open and every win (dholak+bell timbre); shared coin/click/whoosh SFX kit; per-game music only inside gameplay.
- **Iconography:** filled, rounded, 2-tone icons on a strict grid — one master sprite sheet shared by all games.

---

## Part 6 — Asset sourcing playbook

| Need | Source | Notes |
|---|---|---|
| Vector art, UI, boards | In-house Figma/Illustrator | The brand core — always original |
| Character mascots | Commission 1 illustrator (₹25–60K / $300–800 per character set) | Work-for-hire contract, full IP assignment |
| Greybox/prototyping | Kenney.nl, OpenGameArt (CC0) | Replace before launch; check each license |
| Icons (tiles, merge items) | Commissioned set or redrawn originals | Never trace competitor assets |
| SFX | ZapSplat, Freesound (CC0/CC-BY), jsfxr | Keep a license log per file |
| Music | Pixabay Music, Uppbeat, or commissioned loops | Avoid "sounds like" famous game themes |
| AI-generated art | Use for concepting/backgrounds only, human-modified | Pure AI output has weak copyright protection in India/US — keep humans in the loop for brand assets |
| Fonts | Google Fonts (OFL) | Baloo 2, Nunito Sans |
| Trivia content | Original authored + LLM-drafted, human-verified | Never scrape existing question banks |

**IP hygiene checklist (every game, before launch):** original name (trademark search on IP India + USPTO), original palette/art/SFX, no copied level data, no sound-alike audio, license log for every third-party asset, and a screenshot side-by-side review vs. the inspiring title — if a lawyer squints and sees them as siblings, redesign.

---

## Part 7 — Monetization & retention system (platform-level)

**Economy:** one cross-game coin currency (earned everywhere, spent everywhere — the super-app advantage no single game has). Coins buy boosters, skins, tournament entries (virtual-prize only in India).

**Revenue stack, in priority order:**
1. Rewarded video (revives, boosters, coin doublers) — highest-eCPM, user-positive, ideal for India
2. Interstitials (staged, frequency-capped via Remote Config)
3. Booster IAP bundles (₹79–499) — the verified hybrid-casual driver
4. Remove-ads (₹199) + starter packs
5. Cosmetics (Board Race skins, mascot outfits)
6. Season pass across ALL games (unique to a multi-game platform) — wave 2
7. Global: same stack shifted toward IAP (60/40 per verified benchmarks)

**Retention stack:**
- **Daily:** login rewards (escalating 7-day cycle), one shared **Daily Challenge** across all games (today: block puzzle; tomorrow: quiz) — the single most important habit feature
- **Weekly:** leagues (bronze→diamond leaderboards), weekend tournaments (free entry, coin prizes)
- **Long-term:** cross-game XP level, achievement wall, collectible mascot stickers earned in every game (completion loop)
- **Social:** referral coins, Board Race invite links, daily-quiz share cards (Wordle-style emoji grids), WhatsApp-first share targets for India

**Compliance guardrails (India):** no real-money stakes or cash prizes (2025 online gaming law); no casino visual framing; Play Store families-policy-safe ad placements; age-appropriate content throughout.

---

## Research caveats (honest limits)
- Nearly all market figures are modeled estimates (Sensor Tower/AppMagic) counting net IAP only — ad revenue of these formats is understated in the data.
- No claims survived verification on TikTok/Reels virality specifics, word games, idle/clicker demand, or WinZO/MPL-embedded-game benchmarks — the Trivia and word-game picks are strategic inference, flagged as such.
- Color Block Jam's growth partly reflects heavy paid UA, not pure design/virality — don't expect its curve organically.
- Hybrid-casual puzzle is crowded (2,500+ launches in H1 2025): our edge must come from the platform (cross-game economy, daily habit loop, Indian design language), not from any single game.
- India regulatory analysis of the 2025 gaming law should get a proper legal review before any tournament/prize feature ships.
