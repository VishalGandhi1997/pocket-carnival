// Snakes & Ladders — classic public-domain board race.
// Roll dice, climb ladders, avoid snakes, first to square 100 wins.
// Modes: vs Bot (auto-rolls) or Pass & Play (hand the phone over).
// Bot mode has a persistent level ladder: each level the board gets meaner
// (more/longer snakes, fewer/shorter ladders). Beat the bot to level up.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, makeTurnBanner, showOverlay, type Hud } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

type Jumps = Record<number, number>;

// Level 1 (and Pass & Play) = the classic hand-tuned board.
const CLASSIC_LADDERS: Jumps = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
const CLASSIC_SNAKES: Jumps = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 95: 72 };

const snakeCount = (level: number) => Math.min(13, 8 + Math.floor((level - 1) / 2));
const ladderCount = (level: number) => Math.max(4, 7 - Math.floor((level - 1) / 2));
// Snakes bite deeper and ladders climb less as the level rises (capped).
const minSnakeDrop = (level: number) => Math.min(25, 10 + level * 2);
const maxSnakeDrop = (level: number) => Math.min(50, 30 + level * 3);
const maxLadderClimb = (level: number) => Math.max(14, 32 - level * 2);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rowOf = (n: number) => Math.floor((n - 1) / 10);

/** Deterministic board for a level: same level → same board every time. */
function boardForLevel(level: number): { ladders: Jumps; snakes: Jumps } {
  if (level <= 1) return { ladders: { ...CLASSIC_LADDERS }, snakes: { ...CLASSIC_SNAKES } };
  const rnd = mulberry32(level * 9973 + 17);
  const randInt = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const used = new Set<number>([1, 100]); // nothing starts or ends on 1 or 100
  const ladders: Jumps = {};
  const snakes: Jumps = {};
  const place = (target: Jumps, count: number, up: boolean) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < 2000; tries++) {
      const start = up ? randInt(2, 90) : randInt(12, 99);
      const len = up ? randInt(8, maxLadderClimb(level)) : randInt(minSnakeDrop(level), maxSnakeDrop(level));
      const end = up ? start + len : start - len;
      if (end < 2 || end > 99) continue;
      if (rowOf(start) === rowOf(end)) continue; // always cross at least one row
      if (used.has(start) || used.has(end)) continue; // no shared starts/ends
      used.add(start);
      used.add(end);
      target[start] = end;
      placed++;
    }
  };
  place(snakes, snakeCount(level), false);
  place(ladders, ladderCount(level), true);
  return { ladders, snakes };
}

function cellPos(n: number) {
  const idx = n - 1;
  const row = Math.floor(idx / 10);
  let col = idx % 10;
  if (row % 2 === 1) col = 9 - col;
  return { gx: col, gy: 9 - row };
}

export function mountSanpSidhi(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  // Level ladder only applies vs the bot; pass & play stays a friendly match.
  const hud: Hud | null = mode === "bot" ? makeHud(host, ["Level", "Wins"]) : null;
  let level = mode === "bot" ? sdk.getLevel("sanpsidhi") : 1;
  let { ladders: LADDERS, snakes: SNAKES } = boardForLevel(level);
  const banner = makeTurnBanner(host);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  const players = [
    { name: "You", color: palette.marigold, pos: 0 },
    { name: mode === "bot" ? "Bot" : "Player 2", color: palette.pink, pos: 0 },
  ];
  let turn = 0;
  let dice = 1;
  let rolling = false;
  let anim: { from: number; to: number; t: number; player: number } | null = null;
  let over = false;

  function refreshBanner(rolledSix = false) {
    if (over) return;
    const again = rolledSix ? " · Rolled a 6, go again!" : "";
    if (turn === 0) banner.set(`🎲 Your Turn — Roll!${again}`, "you");
    else banner.set((mode === "bot" ? `🤖 Bot (Lv ${level}) is thinking…` : "🎲 Player 2's Turn — Roll!") + again, "opp");
  }

  function roll() {
    if (rolling || over) return;
    rolling = true;
    let ticks = 0;
    const spin = setInterval(() => {
      dice = 1 + Math.floor(Math.random() * 6);
      diceFace.textContent = DICE_FACES[dice];
      ticks++;
      if (ticks > 8) {
        clearInterval(spin);
        applyRoll();
      }
    }, 60);
  }

  function applyRoll() {
    const p = players[turn];
    const target = p.pos + dice;
    sdk.haptic();
    if (target > 100) {
      rolling = false;
      nextTurn(dice === 6);
      return;
    }
    anim = { from: p.pos, to: target, t: 0, player: turn };
  }

  function landOn(playerIdx: number, square: number) {
    let final = square;
    if (LADDERS[square]) final = LADDERS[square];
    else if (SNAKES[square]) final = SNAKES[square];
    players[playerIdx].pos = final;
    if (final === 100) return win(playerIdx);
    rolling = false;
    nextTurn(dice === 6);
  }

  function nextTurn(again: boolean) {
    if (!again) turn = 1 - turn;
    refreshBanner(again);
    if (mode === "bot" && turn === 1 && !over) setTimeout(roll, 700);
  }

  function win(idx: number) {
    over = true;
    const youWon = idx === 0;
    const leveledUp = mode === "bot" && youWon;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("sanpsidhi", level);
    }
    const coins = sdk.scaleReward(youWon ? 30 : 5, level);
    if (youWon) sdk.submitScore("sanpsidhi", sdk.getBest("sanpsidhi") + 1);
    sdk.addCoins(coins, "Snakes & Ladders");
    hud?.set("Level", level);
    hud?.set("Wins", sdk.getBest("sanpsidhi"));
    banner.set(youWon ? "🏆 You Won!" : `${players[idx].name} Won`, youWon ? "you" : "opp");
    let subtitle = "First to square 100";
    if (leveledUp) subtitle = `Level ${level} — ${snakeCount(level)} snakes, ${ladderCount(level)} ladders, deeper bites`;
    else if (mode === "bot") subtitle = `Bot reached 100 first · win to reach Level ${level + 1}`;
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : youWon ? "You Won! 🏆" : `${players[idx].name} Wins`,
      subtitle,
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function reset() {
    if (mode === "bot") {
      level = sdk.getLevel("sanpsidhi");
      ({ ladders: LADDERS, snakes: SNAKES } = boardForLevel(level));
      hud?.set("Level", level);
      hud?.set("Wins", sdk.getBest("sanpsidhi"));
    }
    players[0].pos = 0;
    players[1].pos = 0;
    turn = 0;
    over = false;
    rolling = false;
    anim = null;
    refreshBanner();
  }

  // dice face + roll button
  const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const diceFace = document.createElement("div");
  diceFace.style.cssText =
    "font-size:44px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(255,255,255,0.92);border-radius:16px;box-shadow:0 4px 0 rgba(0,0,0,0.25);color:#241f3d;";
  diceFace.textContent = DICE_FACES[1];
  const diceBtn = document.createElement("button");
  diceBtn.className = "btn-primary";
  diceBtn.textContent = "🎲 Roll Dice";
  diceBtn.addEventListener("click", () => {
    const humanTurn = turn === 0 || mode === "pnp";
    if (humanTurn && !rolling && !over) roll();
  });
  controls.append(diceFace, diceBtn);
  host.appendChild(controls);

  gc.run((dt) => {
    if (anim) {
      anim.t += dt * 2.4;
      if (anim.t >= 1) {
        const { player, to } = anim;
        players[player].pos = to;
        anim = null;
        landOn(player, to);
      }
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const pad = 8;
    const cell = (gc.w - pad * 2) / 10;

    for (let n = 1; n <= 100; n++) {
      const { gx, gy } = cellPos(n);
      const shade = (gx + gy) % 2 === 0 ? "#4e3c9c" : palette.board;
      roundRect(ctx, pad + gx * cell + 1, pad + gy * cell + 1, cell - 2, cell - 2, 5, shade);
      ctx.fillStyle = "rgba(255,248,236,0.55)";
      ctx.font = `700 ${cell * 0.24}px "Nunito Sans", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(n), pad + gx * cell + 4, pad + gy * cell + 3);
    }

    // ladders (gold lines) and snakes (pink dashed)
    ctx.lineWidth = 4;
    for (const [from, to] of Object.entries(LADDERS)) {
      const a = cellPos(Number(from)), b = cellPos(Number(to));
      ctx.strokeStyle = palette.teal;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pad + a.gx * cell + cell / 2, pad + a.gy * cell + cell / 2);
      ctx.lineTo(pad + b.gx * cell + cell / 2, pad + b.gy * cell + cell / 2);
      ctx.stroke();
    }
    for (const [from, to] of Object.entries(SNAKES)) {
      const a = cellPos(Number(from)), b = cellPos(Number(to));
      ctx.strokeStyle = palette.pink;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(pad + a.gx * cell + cell / 2, pad + a.gy * cell + cell / 2);
      ctx.lineTo(pad + b.gx * cell + cell / 2, pad + b.gy * cell + cell / 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // tokens
    players.forEach((p, i) => {
      const pos = anim && anim.player === i ? lerp(anim.from, anim.to, easeOut(anim.t)) : p.pos;
      if (pos <= 0) return;
      const { gx, gy } = cellPos(Math.round(pos));
      const ox = i === 0 ? -cell * 0.18 : cell * 0.18;
      ctx.beginPath();
      ctx.arc(pad + gx * cell + cell / 2 + ox, pad + gy * cell + cell / 2, cell * 0.22, 0, 7);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });

  reset();

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }
  function easeOut(t: number) {
    return 1 - (1 - t) * (1 - t);
  }

  return () => gc.destroy();
}
