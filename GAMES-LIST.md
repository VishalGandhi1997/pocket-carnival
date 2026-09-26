# Master Roster — 40 Mini-Games

> **STATUS: ALL 40 GAMES ARE BUILT AND LIVE** (32 solo + 8 multiplayer; every
> multiplayer title has vs-Bot and Pass & Play).
>
> **Every game has a persistent difficulty ladder.** Solo games read/write
> `sdk.getLevel(id)` / `setLevel`, show Level in the HUD, get harder each level
> (capped so they never become impossible) and pay more via `scaleReward`.
> Multiplayer games level the **bot** (vs-Bot mode only); Pass & Play is unlevelled.

Titles are original and international (no competitor names). Every game uses a
generic public-domain mechanic with our own theme, art and rules.

**Storage ids never change.** Display names were internationalized in v1.2, but
each game keeps its original `id` (the folder name) so existing saves, best
scores and levels carry over.

## Single-player (32)

| Title | id | Mechanic | What gets harder per level |
|---|---|---|---|
| **Blockfit** | blockbazi | Grid-fit block puzzle (9×9 + 3×3 zones) | More awkward pieces; higher score target |
| **Color Pour** | rangsort | Color sort/pour | More colors (3 → 7) |
| **Double Up** | doguna | Slide-merge numbers | Goal tile doubles (128 → 4096); more 4-spawns |
| **Recall** | yaadrakh | Memory pairs | Grid grows (4×3 → 5×6); memorize-peek from L3; tighter par |
| **Serpent** | naagin | Classic snake | Faster start; higher score target |
| **Peg Drop** | tikkidrop | Peg-board ball drop | Higher target, fewer drops, more peg rows |
| **Tile Trio** | tilamatch | Layered triple-tile match | More tile faces; extra layer from L4 |
| **Minefield** | surang | Minesweeper-style logic | Bigger grid, higher mine density |
| **Brick Smash** | todaphoda | Brick breaker | Faster ball, smaller paddle, 2-hit bricks, more rows |
| **Skyglide** | udaan | One-tap flyer | Narrower gaps, faster scroll |
| **Stack Tower** | chhat | Timing tower stacker | Narrower blocks, faster slide, taller target |
| **Bubble Burst** | bubble | Bubble shooter | More colors, rows drop sooner, more starting rows |
| **Word Ring** | shabdjod | Word connect | 5 → 7 letters, 3 → 5 words (30 hand-checked levels) |
| **Merge Garden** | jodimerge | Merge-2 with orders | More orders, higher-tier orders, fewer starters |
| **Unbolt** | kholdo | Bolt/plate removal | More plates (4 → 8) |
| **Nom City** | nomcity | Eat-and-grow arena | Less time, higher target |
| **Sudoku Zen** | sudoku | Sudoku | More blanks (36 → 58); mistake cap from L3 |
| **Word Hunt** | wordkhoj | Word search | Bigger grid, more words, backwards words from L3 |
| **Pixel Logic** | rangoli | Nonogram-style picture logic | Grid grows (6×6 → 10×10) |
| **Jigsaw Scenes** | tukda | Jigsaw | 3×3 → 4×4 → 5×5 pieces; tighter snap from L4 |
| **Café Empire** | chai | Idle tapper / shop builder | Brew goal ~1000·L^1.5; pricier upgrades |
| **Traffic Dash** | localdash | Endless lane runner | Faster start, denser traffic, higher target |
| **Glow Echo** | chamak | Sequence memory | Longer patterns, faster playback |
| **Math Rush** | hisab | Speed maths | Bigger numbers, new operations, less time |
| **Balloon Pop** | gubbara | Reflex popping with decoys | Faster balloons, more bees |
| **Slide Maze** | bhulbhulaiya | Ice-slide maze | Bigger mazes |
| **Bullseye** | nishana | Timing window | Smaller zone, faster dot |
| **Pipeline** 🆕 | pipeline | Rotate-the-pipes | Grid 4×4 → 9×9, twistier paths; move limit |
| **Switchboard** 🆕 | switchboard | Lights-out toggle | Grid 3×3 → 7×7, deeper scramble; par limit |
| **Paint Flood** 🆕 | paintflood | Flood-fill | Board 8×8 → 16×16, 4 → 7 colors, less move slack |
| **Pin Strike** 🆕 | pinstrike | Throw pins into a spinning target | More pins & obstacles, faster spin, reversals (L3), surges (L6) |
| **Tile Slider** 🆕 | slider | Sliding number puzzle | Deeper shuffle; 3×3 → 4×4 (L4) → 5×5 (L8) |

## Multiplayer (8) — vs Bot + Pass & Play

| Title | id | Mechanic | Bot ladder (vs-Bot mode) |
|---|---|---|---|
| **Race Home** | chaupar | Pachisi-style board race | Random → captures → avoids danger, prefers safe cells |
| **Snakes & Ladders** | sanpsidhi | Snakes & ladders | Board gets more snakes, fewer ladders |
| **Four Up** | charchaal | Four-in-a-row disc drop | Sloppy → win/block → avoids traps → minimax |
| **Paddle Duel** | paddle | Pong-style duel | Faster, more accurate bot; faster ball |
| **Box Claim** | katakat | Dots & boxes | Random → safe play → chain-aware; 5×5 grid from L3 |
| **Quiz Duel** | dimaag | Trivia battle | Bot accuracy 50% → 88%; shorter timer |
| **Carrom Clash** | carrom | Flick-striker board game | Less aim noise; picks best shots |
| **Card Duel** | patta | War-style trick game (no stakes) | Must win by a bigger margin |

## Multiplayer rollout strategy
Category leaders ship with **bots**, not real netcode. We follow the same path:
pass-and-play (zero backend) → bots (offline AI) → async turns (Firebase) →
real-time only where it matters.
