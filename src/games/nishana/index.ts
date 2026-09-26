// Bullseye — precision timing archery. A dot orbits the target ring; tap
// when it's inside the teal arc. Every hit speeds it up, three misses end
// the run. Level raises base speed and shrinks the arc (all capped so high
// levels stay hard but possible).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const TAU = Math.PI * 2;
// (0.9 + 1*0.12) * 1.5 ≈ 1.53 rad/s → Level 1 lap ≈ 4.1s. Speed growth stops
// at Level 12 (≈3.5 rad/s), the arc bottoms out at 18°, and the hit target
// stops growing at Level 10 — so the ladder never becomes impossible.
const baseSpeed = (level: number) => (0.9 + Math.min(level, 12) * 0.12) * 1.5;
const arcWidth = (level: number) => (Math.max(18, 46 - level * 3) * Math.PI) / 180;
const levelUpAt = (level: number) => 12 + Math.min(level, 10) * 3;
const MAX_SPEED = 5; // rad/s ceiling for the per-hit speed-up

/** Normalized angular difference in (-π, π]. */
function angDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

interface Fx {
  angle: number;
  t: number; // seconds left
  label: string;
  color: string;
}

export function mountNishana(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Hits", "Best"]);
  let level = sdk.getLevel("nishana");
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;
  const cx = gc.w / 2;
  const cy = gc.h / 2 + 10; // leave headroom for hearts + banner
  const R = gc.w * 0.36; // orbit radius

  let dotAngle = 0;
  let speed = 0;
  let arcCenter = 0;
  let halfArc = 0;
  let hits = 0;
  let score = 0;
  let lives = 3;
  let streak = 0;
  let traveled = 0; // rad since last attempt — 2 silent laps = miss
  let banner = 0; // "On Fire" banner seconds left
  let over = false;
  let fx: Fx[] = [];

  // Jump the arc somewhere new, always at least ~0.9 rad ahead of the dot
  // so a fresh target is never already under the marker.
  function newArc() {
    arcCenter = (dotAngle + 0.9 + Math.random() * (TAU - 1.8)) % TAU;
  }

  function reset() {
    level = sdk.getLevel("nishana");
    speed = baseSpeed(level);
    halfArc = arcWidth(level) / 2;
    dotAngle = -Math.PI / 2;
    hits = 0;
    score = 0;
    lives = 3;
    streak = 0;
    traveled = 0;
    banner = 0;
    fx = [];
    over = false;
    newArc();
    hud.set("Level", level);
    hud.set("Hits", 0);
    hud.set("Best", sdk.getBest("nishana"));
  }

  function miss() {
    lives--;
    streak = 0;
    traveled = 0;
    sdk.sfx("pop");
    sdk.haptic(60);
    fx.push({ angle: dotAngle, t: 0.5, label: "MISS", color: palette.pink });
    if (lives <= 0) finishGame();
  }

  gc.onDown(() => {
    if (over) return;
    const d = Math.abs(angDiff(dotAngle, arcCenter));
    if (d > halfArc) return miss();
    // HIT — the middle third of the arc pays a PERFECT bonus.
    const perfect = d <= halfArc / 3;
    score += perfect ? 15 : 10;
    hits++;
    streak++;
    speed = Math.min(MAX_SPEED, speed * 1.04);
    traveled = 0;
    sdk.haptic(30);
    if (perfect) sdk.sfx("clear");
    fx.push({
      angle: dotAngle,
      t: 0.5,
      label: perfect ? "PERFECT +15" : "+10",
      color: perfect ? "#ffd166" : palette.teal,
    });
    if (streak % 5 === 0) {
      score += 20;
      banner = 1.4;
    }
    hud.set("Hits", hits);
    newArc();
  });

  function finishGame() {
    over = true;
    const isBest = sdk.submitScore("nishana", score);
    const need = levelUpAt(level);
    const leveledUp = hits >= need;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("nishana", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 12)), level);
    sdk.addCoins(coins, "Bullseye");
    hud.set("Best", sdk.getBest("nishana"));
    hud.set("Level", level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Missed! 🏹",
      subtitle: leveledUp
        ? `Now Level ${level} — faster dot, tighter target`
        : `Score ${score} · ${hits} hits · ${Math.max(0, need - hits)} more hits for Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.run((dt) => {
    if (!over) {
      dotAngle = (dotAngle + speed * dt) % TAU;
      traveled += speed * dt;
      if (traveled >= TAU * 2) miss(); // two full silent orbits
    }
    if (banner > 0) banner -= dt;
    fx = fx.filter((f) => (f.t -= dt) > 0);

    // ── draw ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    // concentric target, gold bullseye
    const rings: [number, string][] = [
      [0.8, palette.cream], [0.6, palette.pink], [0.4, palette.cream], [0.2, "#ffd166"],
    ];
    for (const [f, color] of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * f, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.ink;
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText(String(score), cx, cy); // running score in the bullseye
    // orbit track
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = "rgba(255,248,236,0.25)";
    ctx.lineWidth = 3;
    ctx.stroke();
    // target arc (teal) with brighter PERFECT middle third
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, R, arcCenter - halfArc, arcCenter + halfArc);
    ctx.strokeStyle = palette.teal;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R, arcCenter - halfArc / 3, arcCenter + halfArc / 3);
    ctx.strokeStyle = "#9ff5df";
    ctx.lineWidth = 6;
    ctx.stroke();
    // orbiting marker dot
    const dx = cx + Math.cos(dotAngle) * R;
    const dy = cy + Math.sin(dotAngle) * R;
    ctx.save();
    ctx.shadowColor = palette.marigold;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(dx, dy, 9, 0, TAU);
    ctx.fillStyle = palette.marigold;
    ctx.fill();
    ctx.restore();
    // arrow-thunk / miss effects: radial shaft + expanding flash + label
    for (const f of fx) {
      const a = f.t / 0.5;
      const px = cx + Math.cos(f.angle) * R;
      const py = cy + Math.sin(f.angle) * R;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(f.angle) * (R + 34), cy + Math.sin(f.angle) * (R + 34));
      ctx.lineTo(px, py);
      ctx.strokeStyle = palette.cream;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 10 + (1 - a) * 26, 0, TAU);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillStyle = f.color;
      ctx.fillText(f.label, px, py - 24 - (1 - a) * 14);
      ctx.globalAlpha = 1;
    }
    // lives + streak banner
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("❤️".repeat(lives) + "🤍".repeat(3 - lives), cx, 26);
    if (banner > 0) {
      ctx.globalAlpha = Math.min(1, banner);
      ctx.font = "bold 24px system-ui, sans-serif";
      ctx.fillStyle = "#ffd166";
      ctx.fillText("🔥 On Fire! +20", cx, 56);
      ctx.globalAlpha = 1;
    }
  });

  reset();
  return () => gc.destroy();
}
