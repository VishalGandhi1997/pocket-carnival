// Nom City — eat & grow. Hold your finger down to steer a hungry hole
// through a bazaar: anything smaller than you falls in, every bite makes
// you bigger, and the goal is to devour the whole city before time runs out.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const TIME_LIMIT = 75; // seconds on the clock
const EAT_ANIM = 0.2; // seconds for the suck-in shrink

interface SizeClass {
  emojis: string[];
  rMin: number;
  rMax: number;
  value: number;
  count: number;
}

// ~45 objects total — snacks are plentiful, rickshaws and cows are rare.
const CLASSES: SizeClass[] = [
  { emojis: ["🍬", "🧁", "🍪", "🥜"], rMin: 8, rMax: 10, value: 1, count: 18 },
  { emojis: ["🍎", "🥪", "🥤", "🍕"], rMin: 13, rMax: 16, value: 3, count: 14 },
  { emojis: ["🛵", "🪑", "📦"], rMin: 20, rMax: 24, value: 6, count: 8 },
  { emojis: ["🛺", "🐄", "🛒"], rMin: 30, rMax: 34, value: 12, count: 5 },
];

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
  const hud = makeHud(host, ["Time", "Score"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  const hole = { x: gc.w / 2, y: gc.h / 2, r: gc.w / 22 };
  let objs: Obj[] = [];
  let target: { x: number; y: number } | null = null;
  let down = false;
  let score = 0;
  let timeLeft = TIME_LIMIT;
  let over = false;
  let t = 0; // global clock for glow pulse + wobble

  function reset() {
    hole.x = gc.w / 2;
    hole.y = gc.h / 2;
    hole.r = gc.w / 22;
    target = null;
    down = false;
    score = 0;
    timeLeft = TIME_LIMIT;
    over = false;
    objs = [];
    for (const c of CLASSES) {
      for (let i = 0; i < c.count; i++) {
        const r = c.rMin + Math.random() * (c.rMax - c.rMin);
        const m = r + 6; // keep the emoji fully on the board
        objs.push({
          x: m + Math.random() * (gc.w - m * 2),
          y: m + Math.random() * (gc.h - m * 2),
          r,
          emoji: c.emojis[Math.floor(Math.random() * c.emojis.length)],
          value: c.value,
          huge: c.value >= 12,
          wob: Math.random() * 7,
          eat: -1,
        });
      }
    }
    hud.set("Time", TIME_LIMIT);
    hud.set("Score", 0);
  }

  function end(ateEverything: boolean) {
    if (over) return;
    over = true;
    target = null;
    if (ateEverything) score += 100; // clean-plate bonus
    hud.set("Score", score);
    sdk.haptic(60);
    const isBest = sdk.submitScore("nomcity", score);
    const coins = sdk.scaleReward(Math.max(2, Math.floor(score / 8)), 1);
    sdk.addCoins(coins, "Nom City");
    showOverlay(gc.canvas, {
      title: ateEverything ? "City Devoured! 🕳️" : "Time's Up! ⏰",
      subtitle: `Score ${score}`,
      coins,
      isBest,
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
    // faint bazaar-floor tiles
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
  });

  reset();
  return () => gc.destroy();
}
