# Master Roster — 30 Mini-Games

> **STATUS: ALL 35 GAMES ARE BUILT AND LIVE** (27 solo + 8 multiplayer, every
> multiplayer title with vs-Bot and Pass & Play). The wave tables below are
> kept for historical planning context.
>
> **Skill-ladder pack (progressive-difficulty solo games, persistent levels):**
> Chamak 🔆 (sequence memory) · Hisab Kitab 🧮 (speed maths) · Gubbara Pop 🎈
> (reflex popping with decoys) · Bhul Bhulaiya 🌀 (growing slide-mazes) ·
> Nishana 🏹 (shrinking-window timing). Each reads/writes `sdk.getLevel` /
> `setLevel`, gets harder every level, and pays bigger `scaleReward` coins.

Working titles are original (no competitor names). Every game uses generic public-domain mechanics with our own theme, art, and rules ("take the verb, never the skin").

**Legend:** Complexity L/M/H · Wave = build order · MP mode: PnP = pass-and-play (same device), Bots, Async (turn-by-turn via server), RT = real-time online

## Single-player (22)

| # | Title | Mechanic (generic) | Complexity | Wave | Notes |
|---|-------|--------------------|------------|------|-------|
| 1 | **BlockBazi** | Grid-fit block puzzle (9×9 + 3×3 bonus zones) | L | 1 | #1 format globally; flagship |
| 2 | **Rang Sort** | Color sort/pour puzzle | L | 1 | Spice-tin / bangle theme |
| 3 | **Do Guna** | Slide-merge numbers (2048-style; open-source-origin mechanic) | L | 1 | Quick MVP filler |
| 4 | **Yaad Rakh** | Memory pair-matching | L | 1 | Kids/family reach |
| 5 | **Naagin** | Classic snake | L | 1 | Nostalgia (Nokia-era India) |
| 6 | **Tila Match** | Layered tile triple-match (mahjong-solitaire style) | L-M | 2 | +189% YoY category |
| 7 | **Tikki Drop** | Peg-board ball drop physics (carnival framing, NO casino styling) | L | 2 | Ad inventory game |
| 8 | **Surang** | Logic minefield (minesweeper-style) | L | 2 | Evergreen |
| 9 | **Toda Phoda** | Brick breaker / paddle-ball | L | 2 | Arcade evergreen |
| 10 | **Udaan** | One-tap flyer through gaps | L | 2 | Hyper-casual, clip-friendly |
| 11 | **Chhat Pe Chhat** | Timing-based tower stacker | L | 2 | One-tap, session filler |
| 12 | **Bubble Bazaar** | Bubble shooter (match-3 color pop) | M | 2 | Evergreen, female-skewing |
| 13 | **Shabd Jod** | Word connect (EN + Hindi packs) | M | 2 | Regional-language moat |
| 14 | **Jodi Merge** | Merge-2 lite with orders | M | 3 | Fastest-growing IAP mechanic |
| 15 | **Khol Do!** | Bolt/pin removal physics puzzle | M | 3 | 2.8× YoY category |
| 16 | **Nom City** | Eat-&-grow arena vs bots | M | 3 | Hole-style; bots = no netcode |
| 17 | **Sudoku Sadhana** | Classic sudoku with hints | M | 3 | Public domain, 35+ audience |
| 18 | **Word Khoj** | Word search grid (EN + HI) | L | 3 | Cheap once Shabd Jod ships |
| 19 | **Rangoli Logic** | Picture logic grid (nonogram-style) | M | 3 | Rangoli reveal theme |
| 20 | **Tukda Tukda** | Jigsaw puzzle (our own art) | M | 3 | Long sessions, relaxing |
| 21 | **Chai Empire** | Idle tapper / shop builder | M | 4 | Long-tail retention |
| 22 | **Local Dash** | Endless lane runner (Indian streets) | M-H | 4 | Biggest build; arcade = 19% of India downloads |

## Multiplayer (8)

| # | Title | Mechanic (generic) | MP modes | Complexity | Wave |
|---|-------|--------------------|----------|------------|------|
| 23 | **Chaupar Champs** | Ludo/Pachisi board race (public domain) | PnP → Bots → RT | M | 2 |
| 24 | **Sanp Sidhi** | Snakes & ladders (public domain) | PnP → Bots → RT | L | 2 |
| 25 | **Dimaag Ki Batti** | Trivia battles (original question bank) | Solo → Async 1v1 | L | 2 |
| 26 | **Kata Kat** | Dots & boxes (public domain) | PnP → Bots → Async | L | 3 |
| 27 | **Char Ki Chaal** | Four-in-a-row disc drop (generic mechanic; avoid Hasbro trade dress) | PnP → Bots → Async | L | 3 |
| 28 | **Paddle Panga** | Pong-style paddle duel | Same-screen 2P → Bots | L | 3 |
| 29 | **Carrom Clash** | Carrom-style flick striker (Indian classic) | PnP → Bots → RT | M-H | 4 |
| 30 | **Patta Party** | Classic sevens/trick card game — FREE-PLAY ONLY (no stakes; India 2025 RMG law) | Bots → Async | M | 4 |

## Build waves
- **Wave 1 (platform MVP) — ✅ shipped:** shell + SDK + games 1–5, all playable single-player, zero backend
- **Wave 2 — ✅ shipped:** all 5 core multiplayer games (23, 24, 25, 26, 28 in the roster above) — Chaupar Champs, Sanp Sidhi, Char Ki Chaal, Kata Kat, Paddle Panga — each with vs-Bot AI + local Pass & Play, a mode-select screen, and a per-game "❓ How to Play" tutorial modal (auto-shown on first visit, reopenable anytime).
- **Wave 3:** remaining single-player (tile match, merge, unscrew, sudoku, nonogram) + trivia/carrom/cards multiplayer, async play via Firebase
- **Wave 4:** heavy builds (runner, idle) + real-time online multiplayer (Colyseus) + Android wrap via Capacitor

## Multiplayer games shipped so far
| Game | Modes | Notes |
|---|---|---|
| Chaupar Champs | vs Bot, Pass & Play | Ring+home-stretch race, 2 tokens/player, capture + safe cells, exact-roll finish |
| Sanp Sidhi | vs Bot, Pass & Play | Classic boustrophedon board, original ladder/snake layout |
| Char Ki Chaal | vs Bot, Pass & Play | Bot: win-now → block-opponent → center-weighted heuristic |
| Kata Kat | vs Bot, Pass & Play | Bot avoids giving away 3rd sides; greedy chain-completion |
| Paddle Panga | vs Bot, Pass & Play | True simultaneous 2-finger touch for same-device Pass & Play |

## Multiplayer rollout strategy (verified from research)
Category leaders (Hole.io etc.) ship with **bots**, not real netcode. We follow the same path: pass-and-play (zero backend) → bots (offline AI) → async turns (Firebase) → real-time (only where it matters: Ludo, Carrom).
