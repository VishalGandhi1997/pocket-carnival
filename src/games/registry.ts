import type { Sdk } from "../sdk/platform";
import type { HowToStep } from "../engine/ui";

export type GameMode = "bot" | "pnp";

export interface GameDef {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
  players: "single" | "multi";
  howTo?: HowToStep[];
  /** Mounts the game into host. Returns a cleanup function. */
  mount?: (host: HTMLElement, sdk: Sdk, opts?: { mode?: GameMode }) => () => void;
}

import { mountBlockBazi } from "./blockbazi";
import { mountRangSort } from "./rangsort";
import { mountDoGuna } from "./doguna";
import { mountYaadRakh } from "./yaadrakh";
import { mountNaagin } from "./naagin";
import { mountSanpSidhi } from "./sanpsidhi";
import { mountCharKiChaal } from "./charchaal";
import { mountPaddlePanga } from "./paddle";
import { mountKataKat } from "./katakat";
import { mountChaupar } from "./chaupar";
import { mountTikkiDrop } from "./tikkidrop";
import { mountSurang } from "./surang";
import { mountTodaPhoda } from "./todaphoda";
import { mountChhat } from "./chhat";
import { mountUdaan } from "./udaan";
import { mountSudoku } from "./sudoku";
import { mountTilaMatch } from "./tilamatch";
import { mountBubble } from "./bubble";
import { mountShabdJod } from "./shabdjod";
import { mountJodiMerge } from "./jodimerge";
import { mountKholDo } from "./kholdo";
import { mountNomCity } from "./nomcity";
import { mountWordKhoj } from "./wordkhoj";
import { mountRangoli } from "./rangoli";
import { mountTukda } from "./tukda";
import { mountChai } from "./chai";
import { mountLocalDash } from "./localdash";
import { mountDimaag } from "./dimaag";
import { mountCarrom } from "./carrom";
import { mountPatta } from "./patta";
import { mountChamak } from "./chamak";
import { mountHisab } from "./hisab";
import { mountGubbara } from "./gubbara";
import { mountBhulBhulaiya } from "./bhulbhulaiya";
import { mountNishana } from "./nishana";

// Full 30-game roster (see GAMES-LIST.md). Games without `mount` show as
// "coming soon" — each new game only needs its module + one line here.
export const games: GameDef[] = [
  // ── Single-player, wave 1 ──
  {
    id: "blockbazi", title: "BlockBazi", tagline: "Fit blocks, clear lines", emoji: "🧱", players: "single",
    mount: mountBlockBazi,
    howTo: [
      { icon: "👆", text: "Drag a piece from the tray onto the board." },
      { icon: "🟩", text: "Fill a full row, column, or 3×3 zone to clear it." },
      { icon: "🏆", text: "Game ends when no piece fits — beat your best score!" },
    ],
  },
  {
    id: "rangsort", title: "Rang Sort", tagline: "Sort the colors", emoji: "🌈", players: "single",
    mount: mountRangSort,
    howTo: [
      { icon: "👆", text: "Tap a tin to pick up its top color." },
      { icon: "🫙", text: "Tap another tin to pour — it only pours onto a matching color or empty tin." },
      { icon: "✅", text: "Sort every color into its own tin to clear the level." },
    ],
  },
  {
    id: "doguna", title: "Do Guna", tagline: "Swipe & double up", emoji: "🔢", players: "single",
    mount: mountDoGuna,
    howTo: [
      { icon: "👆", text: "Swipe up, down, left, or right to slide all tiles." },
      { icon: "🔢", text: "Two tiles with the same number merge into double the value." },
      { icon: "🚧", text: "Game ends when the board is full and nothing can merge." },
    ],
  },
  {
    id: "yaadrakh", title: "Yaad Rakh", tagline: "Match the pairs", emoji: "🃏", players: "single",
    mount: mountYaadRakh,
    howTo: [
      { icon: "👆", text: "Tap any two cards to flip them over." },
      { icon: "🧠", text: "If they match, they stay open. If not, they flip back." },
      { icon: "⚡", text: "Match all pairs in as few moves as possible." },
    ],
  },
  {
    id: "naagin", title: "Naagin", tagline: "Classic snake dash", emoji: "🐍", players: "single",
    mount: mountNaagin,
    howTo: [
      { icon: "👆", text: "Swipe (or use arrow keys) to steer the snake." },
      { icon: "🟠", text: "Eat the laddoo to grow longer and score points." },
      { icon: "💥", text: "Don't hit the walls or your own tail!" },
    ],
  },

  // ── Multiplayer, wave 2 ──
  {
    id: "chaupar", title: "Chaupar Champs", tagline: "Board race royale", emoji: "🎲", players: "multi",
    mount: mountChaupar,
    howTo: [
      { icon: "🎲", text: "Roll the dice and race both your tokens around the board." },
      { icon: "⭐", text: "Star cells are safe — land on a rival elsewhere to send them home." },
      { icon: "🎯", text: "You need the exact roll to land on the final home cell." },
      { icon: "🏆", text: "Get both tokens home before your rival wins!" },
    ],
  },
  {
    id: "sanpsidhi", title: "Sanp Sidhi", tagline: "Snakes & ladders", emoji: "🪜", players: "multi",
    mount: mountSanpSidhi,
    howTo: [
      { icon: "🎲", text: "Tap Roll Dice on your turn to move forward." },
      { icon: "🪜", text: "Land at the bottom of a ladder to climb up." },
      { icon: "🐍", text: "Land on a snake's head and slide back down." },
      { icon: "🏁", text: "First to land exactly on square 100 wins." },
    ],
  },
  {
    id: "charchaal", title: "Char Ki Chaal", tagline: "Four in a row", emoji: "🔴", players: "multi",
    mount: mountCharKiChaal,
    howTo: [
      { icon: "👆", text: "Tap a column to drop your disc into it." },
      { icon: "➖", text: "Connect 4 of your discs in a row — across, up-down, or diagonal." },
      { icon: "🚫", text: "Block your rival's line before they connect four first." },
    ],
  },
  {
    id: "paddle", title: "Paddle Panga", tagline: "Same-screen duel", emoji: "🏓", players: "multi",
    mount: mountPaddlePanga,
    howTo: [
      { icon: "👆", text: "Drag anywhere on your half to slide your paddle." },
      { icon: "🤝", text: "Pass & Play: both hold the phone — your end vs their end." },
      { icon: "🏐", text: "Don't let the ball pass your paddle." },
      { icon: "🏆", text: "First to 5 points wins the match." },
    ],
  },
  {
    id: "katakat", title: "Kata Kat", tagline: "Dots & boxes duel", emoji: "✏️", players: "multi",
    mount: mountKataKat,
    howTo: [
      { icon: "👆", text: "Tap between two dots to draw a line." },
      { icon: "🔲", text: "Complete a box's 4th side to claim it — and go again!" },
      { icon: "🏆", text: "Most boxes when the grid is full wins." },
    ],
  },

  {
    id: "tikkidrop", title: "Tikki Drop", tagline: "Carnival ball drop", emoji: "🎯", players: "single",
    mount: mountTikkiDrop,
    howTo: [
      { icon: "👆", text: "Tap anywhere up top to drop your tikki." },
      { icon: "🎯", text: "It bounces through the pegs into a prize slot." },
      { icon: "⭐", text: "Aim for the gold center slots — they're worth the most!" },
      { icon: "🔟", text: "You get 10 drops per round. Rack up the highest score." },
    ],
  },

  // ── Wave 2+ single-player (coming soon) ──
  {
    id: "tilamatch", title: "Tila Match", tagline: "Triple-tile picker", emoji: "🀄", players: "single",
    mount: mountTilaMatch,
    howTo: [
      { icon: "👆", text: "Tap free tiles (not covered by a higher layer) to pick them up." },
      { icon: "3️⃣", text: "Three matching tiles in your tray pop together." },
      { icon: "😵", text: "Fill all 7 tray slots with no match and it's over — clear the board!" },
    ],
  },
  {
    id: "surang", title: "Surang", tagline: "Mind the mines", emoji: "💣", players: "single",
    mount: mountSurang,
    howTo: [
      { icon: "👆", text: "Tap a tile to uncover it. Numbers show how many mines are next to it." },
      { icon: "🚩", text: "Turn on Flag mode to mark tiles you think are mines." },
      { icon: "💥", text: "Uncover a mine and it's game over — clear all safe tiles to win!" },
    ],
  },
  {
    id: "todaphoda", title: "Toda Phoda", tagline: "Break every brick", emoji: "🧨", players: "single",
    mount: mountTodaPhoda,
    howTo: [
      { icon: "👆", text: "Drag to move your paddle along the bottom." },
      { icon: "🏀", text: "Tap to launch the ball, then keep it bouncing." },
      { icon: "🧱", text: "Smash every brick. Miss the ball 3 times and you're out." },
    ],
  },
  {
    id: "udaan", title: "Udaan", tagline: "One-tap flight", emoji: "🪁", players: "single",
    mount: mountUdaan,
    howTo: [
      { icon: "👆", text: "Tap to flap the kite upward — it falls when you don't." },
      { icon: "🪁", text: "Fly through the gaps between the obstacles." },
      { icon: "💥", text: "One touch and you're down. How far can you glide?" },
    ],
  },
  {
    id: "chhat", title: "Chhat Pe Chhat", tagline: "Stack it high", emoji: "🏗️", players: "single",
    mount: mountChhat,
    howTo: [
      { icon: "👆", text: "Tap to drop the moving block onto the tower." },
      { icon: "✂️", text: "Any overhang gets sliced off — line them up perfectly." },
      { icon: "🏙️", text: "Miss the stack completely and the tower topples. Go high!" },
    ],
  },
  {
    id: "bubble", title: "Bubble Bazaar", tagline: "Pop the bubbles", emoji: "🫧", players: "single",
    mount: mountBubble,
    howTo: [
      { icon: "🎯", text: "Aim with your finger, release to shoot the bubble." },
      { icon: "🫧", text: "Match 3 or more of the same colour to pop them." },
      { icon: "⬇️", text: "Cut off a cluster and the whole bunch drops for bonus points!" },
    ],
  },
  {
    id: "shabdjod", title: "Shabd Jod", tagline: "Connect the words", emoji: "🔤", players: "single",
    mount: mountShabdJod,
    howTo: [
      { icon: "👆", text: "Tap letters in the ring to build a word." },
      { icon: "✓", text: "Submit to check it — find every hidden word." },
      { icon: "🔤", text: "Clear all the words to finish the level!" },
    ],
  },
  {
    id: "jodimerge", title: "Jodi Merge", tagline: "Merge & deliver", emoji: "🎁", players: "single",
    mount: mountJodiMerge,
    howTo: [
      { icon: "🤏", text: "Drag one item onto its identical twin to merge them up a tier." },
      { icon: "📦", text: "Tap the Crate to spawn new starter items." },
      { icon: "🎁", text: "Drag finished items onto matching orders to deliver — 8 orders wins!" },
    ],
  },
  {
    id: "kholdo", title: "Khol Do!", tagline: "Unscrew the machine", emoji: "🔩", players: "single",
    mount: mountKholDo,
    howTo: [
      { icon: "🔩", text: "Tap bolts to unscrew them — but only if no plate covers them." },
      { icon: "🧩", text: "Free all of a plate's bolts and the plate falls away." },
      { icon: "🏆", text: "Dismantle every plate to clear the level!" },
    ],
  },
  {
    id: "nomcity", title: "Nom City", tagline: "Eat & grow arena", emoji: "🕳️", players: "single",
    mount: mountNomCity,
    howTo: [
      { icon: "👆", text: "Hold and drag — the hungry hole follows your finger." },
      { icon: "🍬", text: "Swallow things smaller than you to grow bigger." },
      { icon: "🛺", text: "Grow huge enough to eat rickshaws before time runs out!" },
    ],
  },
  {
    id: "sudoku", title: "Sudoku Sadhana", tagline: "Zen number logic", emoji: "🔢", players: "single",
    mount: mountSudoku,
    howTo: [
      { icon: "👆", text: "Tap an empty cell, then tap a number to fill it in." },
      { icon: "🔢", text: "Each row, column and 3×3 box must contain 1–9 with no repeats." },
      { icon: "🧩", text: "Conflicts show in red. Fill the whole grid correctly to win." },
    ],
  },
  {
    id: "wordkhoj", title: "Word Khoj", tagline: "Find hidden words", emoji: "🔎", players: "single",
    mount: mountWordKhoj,
    howTo: [
      { icon: "👆", text: "Press a letter and drag in a straight line to select a word." },
      { icon: "↔️", text: "Words hide across, down, and diagonally — forwards or backwards." },
      { icon: "🔎", text: "Find all 6 words as fast as you can!" },
    ],
  },
  {
    id: "rangoli", title: "Rangoli Logic", tagline: "Picture logic grid", emoji: "🪷", players: "single",
    mount: mountRangoli,
    howTo: [
      { icon: "🔢", text: "The numbers show runs of filled cells in each row and column." },
      { icon: "🖌️", text: "Fill cells you're sure of; use Mark mode for notes." },
      { icon: "⚠️", text: "3 wrong fills and the rangoli smudges — complete the picture!" },
    ],
  },
  {
    id: "tukda", title: "Tukda Tukda", tagline: "Calm jigsaws", emoji: "🧩", players: "single",
    mount: mountTukda,
    howTo: [
      { icon: "🤏", text: "Drag the scattered pieces onto the board." },
      { icon: "🧲", text: "Near the right slot? It snaps into place." },
      { icon: "🖼️", text: "Complete the picture — every puzzle is freshly painted." },
    ],
  },
  {
    id: "chai", title: "Chai Empire", tagline: "Build your tapri", emoji: "☕", players: "single",
    mount: mountChai,
    howTo: [
      { icon: "👆", text: "Tap the glass to brew chai." },
      { icon: "🧑‍🍳", text: "Hire assistants and stoves to brew automatically." },
      { icon: "💰", text: "Cash out whenever you like to convert chai into coins!" },
    ],
  },
  {
    id: "localdash", title: "Local Dash", tagline: "Street runner", emoji: "🛺", players: "single",
    mount: mountLocalDash,
    howTo: [
      { icon: "👈", text: "Swipe left or right to switch lanes." },
      { icon: "🚗", text: "Dodge the traffic — watch out for sleepy cows!" },
      { icon: "🪙", text: "Grab coins and survive as the streets speed up." },
    ],
  },

  // ── Skill ladder pack: progressively harder solo games ──
  {
    id: "chamak", title: "Chamak", tagline: "Repeat the glow", emoji: "🔆", players: "single",
    mount: mountChamak,
    howTo: [
      { icon: "👀", text: "Watch the pads light up in a pattern." },
      { icon: "👆", text: "Repeat the pattern by tapping the pads in order." },
      { icon: "📈", text: "Each success adds a step — higher levels start longer and play faster!" },
    ],
  },
  {
    id: "hisab", title: "Hisab Kitab", tagline: "Speed maths rush", emoji: "🧮", players: "single",
    mount: mountHisab,
    howTo: [
      { icon: "🧮", text: "Solve the sum before the timer drains." },
      { icon: "🔥", text: "Streaks earn bonus points — don't break the chain!" },
      { icon: "📈", text: "Level up for harder sums: bigger numbers, tables, two-step maths." },
    ],
  },
  {
    id: "gubbara", title: "Gubbara Pop", tagline: "Pop, don't sting", emoji: "🎈", players: "single",
    mount: mountGubbara,
    howTo: [
      { icon: "🎈", text: "Tap balloons before they float away — gold ones pay extra." },
      { icon: "🐝", text: "DON'T tap the bees. They sting a life away." },
      { icon: "📈", text: "Higher levels: faster balloons, more bees. 3 lives — go!" },
    ],
  },
  {
    id: "bhulbhulaiya", title: "Bhul Bhulaiya", tagline: "Slide the maze", emoji: "🌀", players: "single",
    mount: mountBhulBhulaiya,
    howTo: [
      { icon: "👆", text: "Swipe to slide — you glide until you hit a wall." },
      { icon: "🪙", text: "Grab the hidden coins in dead ends on your way." },
      { icon: "🚪", text: "Reach the glowing exit. Every level the maze grows bigger!" },
    ],
  },
  {
    id: "nishana", title: "Nishana", tagline: "Perfect timing", emoji: "🏹", players: "single",
    mount: mountNishana,
    howTo: [
      { icon: "🏹", text: "Tap when the orbiting dot is inside the teal zone." },
      { icon: "🎯", text: "Dead-center hits score PERFECT bonuses." },
      { icon: "📈", text: "The zone shrinks and the dot speeds up as you level!" },
    ],
  },

  // ── Multiplayer wave 3 ──
  {
    id: "dimaag", title: "Dimaag Ki Batti", tagline: "Quiz battles", emoji: "💡", players: "multi",
    mount: mountDimaag,
    howTo: [
      { icon: "❓", text: "10 rapid questions — answer before the timer drains." },
      { icon: "💡", text: "Each correct answer scores 10 for your side." },
      { icon: "🏆", text: "Beat the bot (or your friend in Pass & Play) to win!" },
    ],
  },
  {
    id: "carrom", title: "Carrom Clash", tagline: "Flick the striker", emoji: "⚪", players: "multi",
    mount: mountCarrom,
    howTo: [
      { icon: "🎯", text: "Drag back from the striker like a slingshot, release to shoot." },
      { icon: "⚪", text: "Pocket your colour pucks in the corners — the gold queen is +3." },
      { icon: "🏆", text: "Clear your pucks and outscore your rival!" },
    ],
  },
  {
    id: "patta", title: "Patta Party", tagline: "Classic cards, no stakes", emoji: "🂡", players: "multi",
    mount: mountPatta,
    howTo: [
      { icon: "🂡", text: "Tap Flip — both sides reveal their top card." },
      { icon: "👑", text: "Higher card takes the trick. Ace is the boss." },
      { icon: "🔥", text: "A tie sparks a DHAMAKA — the next trick counts double!" },
    ],
  },
];
