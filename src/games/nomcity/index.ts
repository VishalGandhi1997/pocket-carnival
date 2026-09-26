// Nom City — eat & grow. Hold your finger down to steer a hungry hole
// through a busy city: anything smaller than you falls in, every bite makes
// you bigger, and the goal is to hit the level's score target (or devour the
// whole city) before time runs out.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const EAT_ANIM = 0.2; // seconds for the suck-in shrink
const CLEAN_BONUS = 100; // eat literally everything → bonus

// ── Level curve ── shorter clock, higher target, a busier city each level.
const roundTime = (level: number) => Math.max(45, 75 - (level - 1) * 4);
const targetFor = (level: number) => 120 + level * 60;
const objectCount = (level: number) => Math.min(70, 45 + level * 3);
// The target never exceeds this share of the points actually on the board,
// so a high level stays tough but always reachable.
const TARGET_MAX_SHARE = 0.7;

interface SizeClass {
  emojis: string[];
  rMin: number;
  rMax: number;
  value: number;
  count: number; // share at the 45-object baseline; scaled up per level
}

// Snacks are plentiful, taxis, buses and trees are rare.
const CLASSES: SizeClass[] = [
  { emojis: ["🍬", "🧁", "🍪", "🍩"], rMin: 8, rMax: 10, value: 2, count: 18 },
  { emojis: ["🍎", "🍔", "🥤", "🍕"], rMin: 13, rMax: 16, value: 6, count: 14 },
  { emojis: ["🚲", "🛴", "🗑️", "📦"], rMin: 20, rMax: 24, value: 12, count: 8 },
  { emojis: ["🚕", "🚌", "🌳", "🚗"], rMin: 30, rMax: 34, value: 24, count: 5 },
];
const BASE_COUNT = CLASSES.reduce((s, c) => s + c.count, 0);

interface Obj {
  x: number;
  y: number;
  r: number;
  emoji: string;
  value: number;
  huge: boolean;
  wob: number; // per-object phase so the idle bob isn't synchronised
  eat: number; // -1 = free; otherwise 0..1 swallow-animation progress
}

export function mountNomCity(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Time", "Score", "Goal"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  const hole = { x: gc.w / 2, y: gc.h / 2, r: gc.w / 22 };
  let objs: Obj[] = [];
  let target: { x: number; y: number } | null = null;
  let down = false;
  let score = 0;
  let level = sdk.getLevel("nomcity");
  let timeLimit = roundTime(level);
  let goal = targetFor(level);
  let goalFlash = 0; // seconds left on the "Goal reached!" banner
  let goalHit = false;
  let timeLeft = timeLimit;
  let over = false;
  let t = 0; // global clock for glow pulse + wobble

  function reset() {
    level = sdk.getLevel("nomcity");
    timeLimit = roundTime(level);
    hole.x = gc.w / 2;
    hole.y = gc.h / 2;
    hole.r = gc.w / 22;
    target = null;
    down = false;
    score = 0;
    timeLeft = timeLimit;
    over = false;
    goalHit = false;
    goalFlash = 0;
    objs = [];
    const total = objectCount(level);
    let placed = 0;
    CLASSES.forEach((c, ci) => {
      // Scale each class proportionally; the last class absorbs rounding.
      const n =
        ci === CLASSES.length - 1 ? total - placed : Math.round((c.count * total) / BASE_COUNT);
      placed += n;
      for (let i = 0; i < n; i++) {
        const r = c.rMin + Math.random() * (c.rMax - c.rMin);
        const m = r + 6; // keep the emoji fully on the board
        objs.push({
          x: m + Math.random() * (gc.w - m * 2),
          y: m + Math.random() * (gc.h - m * 2),
          r,
          emoji: c.emojis[Math.floor(Math.random() * c.emojis.length)],
          value: c.value,
          huge: c.value >= 24,
          wob: Math.random() * 7,
          eat: -1,
        });
      }
    });
    const boardPoints = objs.reduce((s, o) => s + o.value, 0);
    goal = Math.min(targetFor(level), Math.floor(boardPoints * TARGET_MAX_SHARE));
    hud.set("Level", level);
    hud.set("Time", timeLimit);
    hud.set("Score", 0);
    hud.set("Goal", goal);
  }

  function end(ateEverything: boolean) {
    if (over) return;
    over = true;
    target = null;
    if (ateEverything) score += CLEAN_BONUS; // clean-plate bonus
    hud.set("Score", score);
    sdk.haptic(60);
    const isBest = sdk.submitScore("nomcity", score);
    const leveledUp = score >= goal;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("nomcity", level);
      hud.set("Level", level);
    }
    const coins = sdk.scaleReward(Math.max(2, Math.floor(score / 16)), level);
    sdk.addCoins(coins, "Nom City");
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : ateEverything ? "City Devoured! 🕳️" : "Time's Up! ⏰",
      subtitle: leveledUp
        ? `Level ${level} — ${roundTime(level)}s clock, bigger city, higher goal`
        : `Score ${score} · ${Math.max(0, goal - score)} more for Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // While the pointer is held, the hole chases it; release to stop.
  gc.onDown((p) => {
    down = true;
    target = { x: clamp(p.x, 0, gc.w), y: clamp(p.y, 0, gc.h) };
  });
  gc.onMove((p) => {
    if (down) target = { x: clamp(p.x, 0, gc.w), y: clamp(p.y, 0, gc.h) };
  });
  gc.onUp(() => {
    down = false;
    target = null;
  });

  function drawEmoji(e: string, x: number, y: number, r: number) {
    ctx.font = `${Math.max(4, r * 2)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e, x, y);
  }

  gc.run((dt) => {
    t += dt;
    if (!over) {
      timeLeft -= dt;
      hud.set("Time", Math.max(0, Math.ceil(timeLeft)));
      if (timeLeft <= 0) end(false);

      // steer toward the held pointer at a capped speed
      if (target) {
        const dx = target.x - hole.x;
        const dy = target.y - hole.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const k = Math.min(1, (gc.w * 0.5 * dt) / dist);
          hole.x += dx * k;
          hole.y += dy * k;
        }
      }

      // anything small enough whose centre is over the hole gets sucked in
      for (const o of objs) {
        if (o.eat < 0 && o.r < hole.r * 0.95 && Math.hypot(o.x - hole.x, o.y - hole.y) < hole.r) {
          o.eat = 0;
          score += o.value;
          hole.r = Math.sqrt(hole.r * hole.r + o.r * o.r * 0.35);
          hud.set("Score", score);
          sdk.haptic();
          sdk.sfx(o.huge ? "clear" : "pop");
        }
      }
      // first time the level goal is crossed: celebrate, keep playing
      if (!goalHit && score >= goal) {
        goalHit = true;
        goalFlash = 1.6;
        sdk.sfx("clear");
      }
      // advance swallow animations (pulled toward the moving hole), drop finished
      for (const o of objs) {
        if (o.eat >= 0) {
          o.eat += dt / EAT_ANIM;
          const pull = Math.min(1, dt * 14);
          o.x += (hole.x - o.x) * pull;
          o.y += (hole.y - o.y) * pull;
        }
      }
      objs = objs.filter((o) => o.eat < 1);
      if (objs.length === 0) end(true);
    }

    // ── draw ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    // faint city-block pavement tiles
    const tile = gc.w / 10;
    for (let ty = 0; ty < 10; ty++)
      for (let tx = 0; tx < 10; tx++)
        if ((tx + ty) % 2 === 0)
          roundRect(ctx, tx * tile + 2, ty * tile + 2, tile - 4, tile - 4, 4, "rgba(255,248,236,0.025)");

    // 1) objects the hole already dwarfs sit under it (it rolls over them)
    for (const o of objs)
      if (o.eat < 0 && o.r < hole.r) drawEmoji(o.emoji, o.x, o.y + Math.sin(t * 2 + o.wob) * 1.5, o.r);

    // 2) the hole — dark disc with inner depth and a pulsing glow ring
    ctx.save();
    ctx.shadowColor = "#c77dff";
    ctx.shadowBlur = 14 + Math.sin(t * 3) * 5;
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.r, 0, 7);
    ctx.fillStyle = "#0d0a1f";
    ctx.fill();
    ctx.restore();
    const g = ctx.createRadialGradient(hole.x, hole.y, hole.r * 0.1, hole.x, hole.y, hole.r);
    g.addColorStop(0, "rgba(0,0,0,0.95)");
    g.addColorStop(1, "rgba(69,52,140,0.35)");
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.r, 0, 7);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(199,125,255,${0.55 + Math.sin(t * 3) * 0.2})`;
    ctx.stroke();

    // 3) anything mid-swallow shrinks into the dark disc, drawn on top of it
    for (const o of objs) if (o.eat >= 0) drawEmoji(o.emoji, o.x, o.y, o.r * Math.max(0, 1 - o.eat));

    // 4) objects still too big sit on top — the hole slides underneath them
    for (const o of objs)
      if (o.eat < 0 && o.r >= hole.r) drawEmoji(o.emoji, o.x, o.y + Math.sin(t * 2 + o.wob) * 1.5, o.r);

    // 5) brief "goal reached" banner
    if (goalFlash > 0) {
      goalFlash -= dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, goalFlash * 2);
      ctx.font = `bold ${Math.round(gc.w * 0.07)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = palette.cream;
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 8;
      ctx.fillText("🎯 Goal reached!", gc.w / 2, gc.h * 0.12);
      ctx.restore();
    }
  });

  reset();
  return () => gc.destroy();
}
