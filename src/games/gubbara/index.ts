// Gubbara Pop — tap the rising balloons before they float away. Golden
// gubbaras pay big, bees sting. Gets faster (and buzzier) as you level up.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

interface Balloon {
  x: number; // anchor x — actual x adds a sine sway
  y: number;
  r: number; // ellipse rx (ry is slightly taller)
  color: string;
  golden: boolean;
  bee: boolean;
  phase: number; // per-balloon sway offset
  sway: number; // sway amplitude
  dead: boolean;
}

// life runs 1 → 0 and drives the fade-out.
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

// Higher level → faster rise, tighter spawns, more bees. Capped so it stays humanly poppable.
const riseSpeed = (h: number, level: number) => Math.min(h * 0.4, h * (0.16 + level * 0.02));
const spawnEvery = (level: number) => Math.max(0.35, 0.9 - level * 0.05);
const beeChance = (level: number) => Math.min(0.35, 0.05 + level * 0.03);
const levelUpAt = (level: number) => 150 + level * 50;

export function mountGubbara(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Score", "Best"]);
  let level = sdk.getLevel("gubbara");
  const gc = createGameCanvas(host, 1.4);
  const { ctx } = gc;

  let balloons: Balloon[] = [];
  let parts: Particle[] = [];
  let score = 0, lives = 3, over = false;
  let elapsed = 0; // seconds into this run — drives sway + the speed ramp
  let spawnTimer = 0;

  function reset() {
    level = sdk.getLevel("gubbara");
    balloons = [];
    parts = [];
    score = 0;
    lives = 3;
    elapsed = spawnTimer = 0;
    over = false;
    hud.set("Level", level);
    hud.set("Score", 0);
    hud.set("Best", sdk.getBest("gubbara"));
  }

  function spawn() {
    const bee = Math.random() < beeChance(level);
    const golden = !bee && Math.random() < 0.08;
    const r = gc.w * (0.055 + Math.random() * 0.03);
    balloons.push({
      x: r * 1.6 + Math.random() * (gc.w - r * 3.2),
      y: gc.h + r * 2.2, // start fully below the bottom edge
      r,
      color: golden ? "#ffd166" : palette.pieces[Math.floor(Math.random() * palette.pieces.length)],
      golden,
      bee,
      phase: Math.random() * Math.PI * 2,
      sway: gc.w * (0.015 + Math.random() * 0.02),
      dead: false,
    });
  }

  function burst(x: number, y: number, color: string) {
    const n = 6 + Math.floor(Math.random() * 3); // 6-8 dots
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const sp = gc.w * (0.35 + Math.random() * 0.4);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
    }
  }

  function loseLife() {
    if (--lives <= 0 && !over) gameOver();
  }

  function gameOver() {
    over = true;
    sdk.haptic(60);
    const isBest = sdk.submitScore("gubbara", score);
    const leveledUp = score >= levelUpAt(level);
    if (leveledUp) {
      level += 1;
      sdk.setLevel("gubbara", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 15)), level);
    sdk.addCoins(coins, "Gubbara Pop");
    hud.set("Best", sdk.getBest("gubbara"));
    hud.set("Level", level);
    const need = levelUpAt(level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Phat Gaya! 🎈",
      subtitle: leveledUp
        ? `Now Level ${level} — faster balloons, bigger coins`
        : `Score ${score} · ${Math.max(0, need - score)} more to reach Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  const swayX = (b: Balloon) => b.x + Math.sin(elapsed * 2 + b.phase) * b.sway;

  gc.onDown((p) => {
    if (over) return;
    // Topmost-drawn first, so overlapping taps hit what the player sees.
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.dead) continue;
      const dx = p.x - swayX(b);
      const dy = p.y - b.y;
      if (dx * dx + dy * dy > (b.r * 1.45) ** 2) continue; // slightly generous hit radius
      b.dead = true;
      if (b.bee) {
        sdk.haptic(60);
        sdk.sfx("pop");
        burst(swayX(b), b.y, palette.ink); // dark puff — that was a mistake
        loseLife();
      } else {
        score += b.golden ? 25 : 5;
        hud.set("Score", score);
        sdk.haptic();
        sdk.sfx(b.golden ? "coin" : "pop");
        burst(swayX(b), b.y, b.color);
      }
      return;
    }
  });

  gc.run((dt) => {
    if (!over) {
      elapsed += dt;
      spawnTimer += dt;
      if (spawnTimer >= spawnEvery(level)) {
        spawnTimer = 0;
        spawn();
      }
      const speed = riseSpeed(gc.h, level) * (1 + 0.01 * elapsed); // +1%/second ramp
      for (const b of balloons) {
        if (b.dead) continue;
        b.y -= speed * dt * (b.bee ? 0.85 : 1);
        if (b.y < -b.r * 2.6) {
          b.dead = true;
          if (!b.bee && !over) {
            sdk.haptic(); // a balloon got away…
            loseLife();
          }
        }
      }
      balloons = balloons.filter((b) => !b.dead);
    }
    // particles keep flying/fading even on the game-over frame
    for (const q of parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += gc.h * 0.6 * dt; // slight gravity
      q.life -= dt * 2.4;
    }
    parts = parts.filter((q) => q.life > 0);

    // ── draw ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    for (const b of balloons) {
      const bx = swayX(b);
      if (b.bee) {
        ctx.font = `${Math.round(b.r * 1.9)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🐝", bx, b.y);
        continue;
      }
      const ry = b.r * 1.18;
      // wavy string
      ctx.strokeStyle = "rgba(255,248,236,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sy = b.y + ry + b.r * 0.2;
      ctx.moveTo(bx, sy);
      for (let s = 1; s <= 4; s++)
        ctx.lineTo(bx + Math.sin(elapsed * 3 + b.phase + s * 1.4) * b.r * 0.22, sy + s * b.r * 0.45);
      ctx.stroke();
      // knot — small triangle under the body
      ctx.beginPath();
      ctx.moveTo(bx, b.y + ry - 1);
      ctx.lineTo(bx - b.r * 0.16, b.y + ry + b.r * 0.22);
      ctx.lineTo(bx + b.r * 0.16, b.y + ry + b.r * 0.22);
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.fill();
      // body
      ctx.save();
      if (b.golden) {
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      ctx.ellipse(bx, b.y, b.r, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();
      // shine
      ctx.beginPath();
      ctx.ellipse(bx - b.r * 0.32, b.y - ry * 0.35, b.r * 0.22, ry * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill();
    }
    // burst particles
    for (const q of parts) {
      ctx.globalAlpha = Math.max(0, q.life);
      ctx.beginPath();
      ctx.arc(q.x, q.y, gc.w * 0.012, 0, Math.PI * 2);
      ctx.fillStyle = q.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // lives row
    ctx.font = `${Math.round(gc.w * 0.05)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("❤️".repeat(Math.max(0, lives)), 12, 10);
  });

  reset();
  return () => gc.destroy();
}
