// Race Home — cross-and-circle style board race (public-domain rules;
// original board art). v1 ships the documented "quick race" variant:
// 2 tokens per player on a shared ring + private home stretch, instead
// of the full 4-token classic. 2 players only (bot or pass & play);
// 4-player support is future work.
// Bot mode has a persistent level ladder: the bot plays smarter each level
// (random → capture/lead-token → danger-aware), and beating it levels you up.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, makeTurnBanner, showOverlay, type Hud } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const N = 11; // board grid size
const RING_LEN = 40;
const HOME_LEN = 5;
const FINISH = RING_LEN + HOME_LEN; // 45
const ENTRY = [5, 25]; // ring index where each player enters/exits
const SAFE_RING_IDX = new Set(ENTRY);

function buildRing(): { gx: number; gy: number }[] {
  const pts: { gx: number; gy: number }[] = [];
  for (let x = 0; x < N - 1; x++) pts.push({ gx: x, gy: 0 });
  for (let y = 0; y < N - 1; y++) pts.push({ gx: N - 1, gy: y });
  for (let x = N - 1; x > 0; x--) pts.push({ gx: x, gy: N - 1 });
  for (let y = N - 1; y > 0; y--) pts.push({ gx: 0, gy: y });
  return pts;
}
const RING = buildRing();
const HOME_STRETCH = [
  [{ gx: 5, gy: 1 }, { gx: 5, gy: 2 }, { gx: 5, gy: 3 }, { gx: 5, gy: 4 }, { gx: 5, gy: 5 }],
  [{ gx: 5, gy: 9 }, { gx: 5, gy: 8 }, { gx: 5, gy: 7 }, { gx: 5, gy: 6 }, { gx: 5, gy: 5 }],
];

function coordFor(player: 0 | 1, pos: number) {
  if (pos >= FINISH) return { gx: 5, gy: 5 };
  if (pos >= RING_LEN) return HOME_STRETCH[player][pos - RING_LEN];
  return RING[(ENTRY[player] + pos) % RING_LEN];
}

interface Token {
  pos: number;
}

// Bot skill tiers by level (bot mode only).
const botRandomChance = (level: number) => (level <= 1 ? 0.6 : 0); // L1: often picks at random
const botDangerAware = (level: number) => level >= 4; // L4+: avoids cells you can hit, likes safe cells
function botSkillLabel(level: number): string {
  if (level <= 1) return "a casual bot";
  if (level <= 3) return "bot now hunts captures";
  return "bot dodges your hits & hugs safe cells";
}

export function mountChaupar(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  // Level ladder only applies vs the bot; pass & play stays a friendly match.
  const hud: Hud | null = mode === "bot" ? makeHud(host, ["Level", "Wins"]) : null;
  let level = mode === "bot" ? sdk.getLevel("chaupar") : 1;
  const banner = makeTurnBanner(host);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  const COLORS: [string, string] = [palette.teal, palette.pink];
  let tokens: [Token[], Token[]] = [[], []];
  let turn: 0 | 1 = 0;
  let dice = 1;
  let rolling = false;
  let awaitingChoice: number[] = []; // movable token indices for current player
  let anim: { player: 0 | 1; idx: number; from: number; to: number; t: number } | null = null;
  let over = false;

  function reset() {
    if (mode === "bot") {
      level = sdk.getLevel("chaupar");
      hud?.set("Level", level);
      hud?.set("Wins", sdk.getBest("chaupar"));
    }
    tokens = [[{ pos: 0 }, { pos: 0 }], [{ pos: 0 }, { pos: 0 }]];
    turn = 0;
    rolling = false;
    awaitingChoice = [];
    anim = null;
    over = false;
    refreshBanner();
  }

  function refreshBanner(extra = "") {
    if (over) return;
    if (turn === 0) banner.set(`🎲 Your Turn${extra}`, "you");
    else banner.set((mode === "bot" ? `🤖 Bot (Lv ${level}) is thinking…` : "🎲 Player 2's Turn") + extra, "opp");
  }

  function movableTokens(player: 0 | 1, roll: number): number[] {
    return tokens[player].map((_, i) => i).filter((i) => tokens[player][i].pos + roll <= FINISH);
  }

  function roll() {
    if (rolling || over || anim) return;
    rolling = true;
    let ticks = 0;
    const spin = setInterval(() => {
      dice = 1 + Math.floor(Math.random() * 6);
      diceFace.textContent = DICE_FACES[dice];
      ticks++;
      if (ticks > 8) {
        clearInterval(spin);
        resolveRoll();
      }
    }, 60);
  }

  function resolveRoll() {
    const movable = movableTokens(turn, dice);
    if (!movable.length) {
      rolling = false;
      refreshBanner(" · No move, passing");
      setTimeout(() => nextTurn(false), 700);
      return;
    }
    if (movable.length === 1) {
      moveToken(turn, movable[0]);
      return;
    }
    // two tokens can move
    if (turn === 1 && mode === "bot") {
      moveToken(turn, chooseBotToken(movable));
    } else {
      awaitingChoice = movable;
      banner.set(turn === 0 ? "Tap a token to move it" : "Player 2: tap a token", turn === 0 ? "you" : "opp");
    }
  }

  function chooseBotToken(movable: number[]): number {
    // L1: a lot of the time just pick any movable token
    if (Math.random() < botRandomChance(level)) return movable[Math.floor(Math.random() * movable.length)];
    if (!botDangerAware(level)) {
      // L2-3: prefer a capture, else the token closer to finishing
      for (const idx of movable) {
        const dest = tokens[1][idx].pos + dice;
        if (dest < RING_LEN && capturesAt(1, dest)) return idx;
      }
      return movable.reduce((best, i) => (tokens[1][i].pos > tokens[1][best].pos ? i : best), movable[0]);
    }
    // L4+: score each option — captures, finishing, safety, and not landing
    // within reach (1–6 steps ahead) of one of your tokens.
    let bestIdx = movable[0];
    let bestScore = -Infinity;
    for (const idx of movable) {
      const from = tokens[1][idx].pos;
      const dest = from + dice;
      let score = dest * 0.5; // mild preference for advancing the lead token
      if (dest >= FINISH) score += 60;
      else if (dest >= RING_LEN) score += 30; // home stretch can't be hit
      else {
        const ringIdx = (ENTRY[1] + dest) % RING_LEN;
        if (capturesAt(1, dest)) score += 100;
        if (SAFE_RING_IDX.has(ringIdx)) score += 20;
        else if (threatenedAt(ringIdx)) score -= 50;
      }
      // bonus for rescuing a token that's currently exposed
      if (from < RING_LEN) {
        const curIdx = (ENTRY[1] + from) % RING_LEN;
        if (!SAFE_RING_IDX.has(curIdx) && threatenedAt(curIdx)) score += 15;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }
    return bestIdx;
  }

  /** Can one of the player's ring tokens land on this ring cell next roll? */
  function threatenedAt(ringIdx: number): boolean {
    return tokens[0].some((t) => {
      if (t.pos >= RING_LEN) return false;
      const pIdx = (ENTRY[0] + t.pos) % RING_LEN;
      const dist = (ringIdx - pIdx + RING_LEN) % RING_LEN;
      return dist >= 1 && dist <= 6 && t.pos + dist < RING_LEN;
    });
  }

  function capturesAt(player: 0 | 1, ringDestPos: number): boolean {
    const opp = player === 0 ? 1 : 0;
    const destRingIdx = (ENTRY[player] + ringDestPos) % RING_LEN;
    if (SAFE_RING_IDX.has(destRingIdx)) return false;
    return tokens[opp].some((t) => t.pos < RING_LEN && (ENTRY[opp] + t.pos) % RING_LEN === destRingIdx);
  }

  function moveToken(player: 0 | 1, idx: number) {
    rolling = false;
    awaitingChoice = [];
    const from = tokens[player][idx].pos;
    const to = from + dice;
    anim = { player, idx, from, to, t: 0 };
    sdk.haptic();
  }

  function finishMove() {
    if (!anim) return;
    const { player, idx, to } = anim;
    anim = null;
    tokens[player][idx].pos = to;

    if (to < RING_LEN) {
      const opp = player === 0 ? 1 : 0;
      const destRingIdx = (ENTRY[player] + to) % RING_LEN;
      if (!SAFE_RING_IDX.has(destRingIdx)) {
        for (const t of tokens[opp]) {
          if (t.pos < RING_LEN && (ENTRY[opp] + t.pos) % RING_LEN === destRingIdx) {
            t.pos = 0;
            sdk.haptic(40);
          }
        }
      }
    }

    if (tokens[player].every((t) => t.pos >= FINISH)) return win(player);
    nextTurn(dice === 6);
  }

  function nextTurn(again: boolean) {
    if (!again) turn = turn === 0 ? 1 : 0;
    refreshBanner(again ? " · Rolled a 6, go again!" : "");
    if (mode === "bot" && turn === 1 && !over) setTimeout(roll, 700);
  }

  function win(player: 0 | 1) {
    over = true;
    const youWon = player === 0;
    const leveledUp = mode === "bot" && youWon;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("chaupar", level);
    }
    const coins = sdk.scaleReward(youWon ? 35 : 8, level);
    if (youWon) sdk.submitScore("chaupar", sdk.getBest("chaupar") + 1);
    sdk.addCoins(coins, "Race Home");
    hud?.set("Level", level);
    hud?.set("Wins", sdk.getBest("chaupar"));
    banner.set(youWon ? "🏆 You Won!" : (mode === "bot" ? "Bot Won" : "Player 2 Won"), youWon ? "you" : "opp");
    let title = youWon ? "You Won! 🏆" : "You Lost";
    let subtitle = "Both tokens home";
    if (leveledUp) {
      title = "⬆️ Level Up!";
      subtitle = `Level ${level} — ${botSkillLabel(level)}`;
    } else if (mode === "bot") {
      subtitle = `Bot got both tokens home · beat the Lv ${level} bot to reach Level ${level + 1}`;
    } else if (!youWon) {
      title = "Player 2 Won";
    }
    showOverlay(gc.canvas, {
      title,
      subtitle,
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  // ── dice UI ──
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
    if (humanTurn && !rolling && !over && !anim && !awaitingChoice.length) roll();
  });
  controls.append(diceFace, diceBtn);
  host.appendChild(controls);

  function layout() {
    const pad = 12;
    const cell = (gc.w - pad * 2) / N;
    return { pad, cell };
  }

  gc.onDown((p) => {
    if (!awaitingChoice.length) return;
    const { pad, cell } = layout();
    for (const idx of awaitingChoice) {
      const { gx, gy } = coordFor(turn as 0 | 1, tokens[turn][idx].pos);
      const cx = pad + gx * cell + cell / 2;
      const cy = pad + gy * cell + cell / 2;
      if (Math.hypot(p.x - cx, p.y - cy) < cell * 0.45) {
        moveToken(turn, idx);
        return;
      }
    }
  });

  gc.run((dt) => {
    if (anim) {
      anim.t += dt * 2.2;
      if (anim.t >= 1) finishMove();
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const { pad, cell } = layout();

    // center home
    roundRect(ctx, pad + 4 * cell, pad + 4 * cell, cell * 3, cell * 3, 10, "#4e3c9c");

    // ring path
    RING.forEach((c, i) => {
      const safe = SAFE_RING_IDX.has(i);
      roundRect(ctx, pad + c.gx * cell + 1, pad + c.gy * cell + 1, cell - 2, cell - 2, 4,
        safe ? "#5b3fc9" : palette.board);
      if (safe) {
        ctx.fillStyle = "rgba(255,248,236,0.7)";
        ctx.font = `${cell * 0.4}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", pad + c.gx * cell + cell / 2, pad + c.gy * cell + cell / 2);
      }
    });
    // home stretches
    HOME_STRETCH.forEach((stretch, pi) => {
      stretch.forEach((c) => {
        roundRect(ctx, pad + c.gx * cell + 1, pad + c.gy * cell + 1, cell - 2, cell - 2, 4,
          pi === 0 ? "rgba(6,214,160,0.35)" : "rgba(239,71,111,0.35)");
      });
    });

    // tokens
    ([0, 1] as const).forEach((player) => {
      tokens[player].forEach((t, idx) => {
        if (t.pos >= FINISH) return;
        const isAnimating = anim && anim.player === player && anim.idx === idx;
        const pos = isAnimating ? anim!.from : t.pos; // draw settled tokens at rest position
        const { gx, gy } = coordFor(player, pos);
        let cx = pad + gx * cell + cell / 2;
        let cy = pad + gy * cell + cell / 2;
        if (isAnimating) {
          const e = 1 - Math.pow(1 - anim!.t, 3);
          const dst = coordFor(player, anim!.to);
          cx = cx + (pad + dst.gx * cell + cell / 2 - cx) * e;
          cy = cy + (pad + dst.gy * cell + cell / 2 - cy) * e;
        }
        const ox = idx === 0 ? -cell * 0.16 : cell * 0.16;
        const highlight = !isAnimating && awaitingChoice.includes(idx) && player === turn;
        if (highlight) {
          ctx.beginPath();
          ctx.arc(cx + ox, cy, cell * 0.32, 0, 7);
          ctx.fillStyle = "rgba(255,215,94,0.5)";
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(cx + ox, cy, cell * 0.22, 0, 7);
        ctx.fillStyle = COLORS[player];
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
  });

  reset();
  return () => gc.destroy();
}
