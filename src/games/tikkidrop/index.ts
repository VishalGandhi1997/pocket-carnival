// Peg Drop — carnival ball-drop. Tap a spot to drop a ball; it bounces
// through the pegs into a prize slot at the bottom. Skill-framed (aim for the
// gold center slots), NOT casino-styled. You get a limited number of drops.
// Each level sets a round goal; beat it to level up (fewer drops, more pegs).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay, showRevive } from "../../engine/ui";
import { floatText } from "../../engine/fx";
import { reviveCost } from "../../sdk/economy";
import type { Sdk } from "../../sdk/platform";

const SLOT_POINTS = [5, 10, 20, 50, 100, 50, 20, 10, 5]; // 9 slots, gold in the middle

// ── Level curve ──
// Drops per round shrink (min 6) and peg rows grow (max 12) every 2 levels.
const dropsFor = (level: number) => Math.max(6, 10 - Math.floor((level - 1) / 2));
const rowsFor = (level: number) => Math.min(12, 8 + Math.floor((level - 1) / 2));
// Goal = 200 + 60/level, capped at 48 points per drop so it always stays
// reachable (well-aimed drops average ~42–54 points in simulation).
const targetFor = (level: number) => Math.min(200 + (level - 1) * 60, dropsFor(level) * 48);

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  settled: boolean;
}

export function mountTikkiDrop(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Goal", "Drops", "Score"]);
  const gc = createGameCanvas(host, 1.3);
  const { ctx, w, h } = gc;

  const topY = h * 0.16;
  const slotY = h * 0.86;
  const slots = SLOT_POINTS.length;
  const slotW = w / slots;

  let level = sdk.getLevel("tikkidrop");
  let rows = rowsFor(level);
  let pegGap = w / (rows + 2);
  let target = targetFor(level);
  let dropsPerRound = dropsFor(level);
  let pegs: { x: number; y: number }[] = [];
  let balls: Ball[] = [];
  let dropsLeft = dropsPerRound;
  let score = 0;
  let over = false;
  let reviveCount = 0;
  let usedAdRevive = false;
  const REVIVE_DROPS = 5;

  function buildPegs() {
    pegs = [];
    pegGap = w / (rows + 2);
    for (let r = 0; r < rows; r++) {
      const count = rows + (r % 2 === 0 ? 1 : 0);
      const rowW = (count - 1) * pegGap;
      const startX = (w - rowW) / 2;
      const y = topY + (r / (rows - 1)) * (slotY - topY - 40);
      for (let c = 0; c < count; c++) pegs.push({ x: startX + c * pegGap, y });
    }
  }

  function reset() {
    level = sdk.getLevel("tikkidrop");
    rows = rowsFor(level);
    target = targetFor(level);
    dropsPerRound = dropsFor(level);
    buildPegs();
    balls = [];
    dropsLeft = dropsPerRound;
    score = 0;
    over = false;
    reviveCount = 0;
    usedAdRevive = false;
    hud.set("Level", level);
    hud.set("Goal", target);
    hud.set("Drops", dropsLeft);
    hud.set("Score", 0);
  }

  function drop(x: number) {
    if (over || dropsLeft <= 0 || balls.some((b) => !b.settled)) return;
    dropsLeft--;
    hud.set("Drops", dropsLeft);
    balls.push({
      x: Math.max(pegGap, Math.min(w - pegGap, x)),
      y: topY - 20,
      vx: (Math.random() - 0.5) * 20,
      vy: 0,
      r: Math.max(7, pegGap * 0.22),
      settled: false,
    });
    sdk.haptic();
  }

  function settle(ball: Ball) {
    ball.settled = true;
    const slot = Math.max(0, Math.min(slots - 1, Math.floor(ball.x / slotW)));
    const pts = SLOT_POINTS[slot];
    score += pts;
    hud.set("Score", score);
    sdk.sfx(pts >= 50 ? "clear" : "coin");
    floatText(gc.canvas.parentElement!, ball.x, slotY - 10, `+${pts}`, pts >= 50 ? palette.marigold : palette.cream);
    if (dropsLeft <= 0 && balls.every((b) => b.settled)) setTimeout(gameOver, 500);
  }

  function gameOver() {
    if (over) return;
    over = true;
    const cost = reviveCost(reviveCount);
    showRevive(gc.canvas, {
      coinCost: cost,
      adAvailable: !usedAdRevive,
      onReviveCoins: () => {
        if (sdk.spendCoins(cost)) {
          reviveCount++;
          dropsLeft += REVIVE_DROPS;
          over = false;
          hud.set("Drops", dropsLeft);
        } else finishGame();
      },
      onReviveAd: async () => {
        const ok = await sdk.watchAd();
        if (ok) {
          usedAdRevive = true;
          dropsLeft += REVIVE_DROPS;
          over = false;
          hud.set("Drops", dropsLeft);
        }
        return ok;
      },
      onDecline: finishGame,
    });
  }

  function finishGame() {
    if (!over) return;
    const isBest = sdk.submitScore("tikkidrop", score);
    const leveledUp = score >= target;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("tikkidrop", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 15)), level);
    sdk.addCoins(coins, "Peg Drop");
    hud.set("Level", level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Round Over! 🎯",
      subtitle: leveledUp
        ? `Level ${level} — goal ${targetFor(level)} in ${dropsFor(level)} drops, ${rowsFor(level)} peg rows`
        : `Score ${score} · ${target - score} more for Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.onDown((p) => drop(p.x));

  gc.run((dt) => {
    // physics
    const step = Math.min(dt, 0.03);
    for (const b of balls) {
      if (b.settled) continue;
      b.vy += 900 * step;
      b.x += b.vx * step;
      b.y += b.vy * step;
      // walls
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
      // peg collisions
      for (const peg of pegs) {
        const dx = b.x - peg.x, dy = b.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const min = b.r + 5;
        if (dist < min && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          b.x = peg.x + nx * min;
          b.y = peg.y + ny * min;
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * 0.55 + (Math.random() - 0.5) * 30;
          b.vy = (b.vy - 2 * dot * ny) * 0.55;
        }
      }
      if (b.y >= slotY - b.r) { b.y = slotY - b.r; settle(b); }
    }

    // render
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);

    // slots
    for (let i = 0; i < slots; i++) {
      const pts = SLOT_POINTS[i];
      const gold = pts >= 50;
      const mid = pts >= 20;
      roundRect(ctx, i * slotW + 2, slotY, slotW - 4, h - slotY - 4, 6,
        gold ? "rgba(255,159,28,0.32)" : mid ? "rgba(76,201,240,0.22)" : "rgba(255,255,255,0.07)");
      ctx.fillStyle = gold ? palette.marigold : palette.cream;
      ctx.font = `800 ${slotW * 0.32}px "Baloo 2", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(pts), i * slotW + slotW / 2, (slotY + h - 4) / 2 + 4);
    }

    // pegs
    for (const peg of pegs) {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, 4, 0, 7);
      ctx.fillStyle = "rgba(255,248,236,0.55)";
      ctx.fill();
    }

    // balls
    for (const b of balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 7);
      ctx.fillStyle = b.settled ? palette.teal : palette.pink;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // aim hint
    if (!over && dropsLeft > 0 && !balls.some((b) => !b.settled)) {
      ctx.fillStyle = "rgba(255,248,236,0.4)";
      ctx.font = `700 ${w * 0.036}px "Nunito Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        score >= target ? "Goal reached! Keep scoring ↓" : "Tap a spot to drop your ball ↓",
        w / 2,
        topY - 34,
      );
    }
  });

  reset();
  return () => gc.destroy();
}
