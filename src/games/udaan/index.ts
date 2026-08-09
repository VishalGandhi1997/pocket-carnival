// Udaan — a one-tap flyer. A kite fights gravity: TAP to flap upward and
// thread through the gaps between teal obstacle pairs. Miss one, clip the
// top, or hit the ground and you're down. Speeds up gently as you score.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

// ── Tuning (CSS-pixel / second units; canvas is ~480×672) ──
const GRAVITY = 1000; // constant downward pull on the kite
const FLAP = -330; // instant upward velocity a tap grants
const GROUND_H = 44; // solid ground strip at the bottom
const OBS_W = 58; // obstacle pair column width
const GAP = 178; // vertical opening the kite flies through
const SPACING = 232; // horizontal distance between successive pairs
const BASE_SPEED = 132; // starting scroll speed
const KITE_R = 15; // kite collision radius

interface Obstacle {
  x: number; // left edge of the column
  gapY: number; // vertical centre of the opening
  passed: boolean; // already counted toward the score?
}

export function mountUdaan(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Score", "Best"]);
  const gc = createGameCanvas(host, 1.4);
  const { ctx, w, h } = gc;
  const floorY = h - GROUND_H; // ground collision line
  const kiteX = w * 0.28; // kite stays at a fixed x

  let kiteY = 0;
  let vel = 0;
  let obstacles: Obstacle[] = [];
  let score = 0;
  let speed = BASE_SPEED;
  let bob = 0; // ready-state hover phase
  let state: "ready" | "play" | "over" = "ready";

  // Random gap centre kept clear of the top and the ground.
  function randGapY(): number {
    const margin = GAP / 2 + 40;
    return margin + Math.random() * (floorY - margin * 2);
  }

  function spawn(x: number) {
    obstacles.push({ x, gapY: randGapY(), passed: false });
  }

  function reset() {
    kiteY = h * 0.45;
    vel = 0;
    score = 0;
    speed = BASE_SPEED;
    bob = 0;
    obstacles = [];
    // Pre-seed a couple of pairs off to the right so play begins with runway.
    spawn(w + 60);
    spawn(w + 60 + SPACING);
    state = "ready";
    hud.set("Score", 0);
    hud.set("Best", sdk.getBest("udaan"));
  }

  function flap() {
    vel = FLAP;
    sdk.haptic();
    sdk.sfx("pop");
  }

  gc.onDown(() => {
    if (state === "over") return; // overlay button handles restart
    if (state === "ready") state = "play";
    flap();
  });

  function gameOver() {
    state = "over";
    sdk.haptic(60);
    const isBest = sdk.submitScore("udaan", score);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 2)), 1);
    sdk.addCoins(coins, "Udaan");
    hud.set("Best", sdk.getBest("udaan"));
    showOverlay(gc.canvas, {
      title: "Down! 🪁",
      subtitle: `Score ${score}`,
      coins,
      isBest,
      mood: "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function update(step: number) {
    // Physics: integrate velocity then position.
    vel += GRAVITY * step;
    kiteY += vel * step;

    // Scroll obstacles left; count passes; recycle spawns at fixed spacing.
    for (const o of obstacles) o.x -= speed * step;
    for (const o of obstacles) {
      if (!o.passed && o.x + OBS_W < kiteX - KITE_R) {
        o.passed = true;
        score += 1;
        speed = BASE_SPEED + score * 3; // gentle ramp keeps it fair
        hud.set("Score", score);
        sdk.sfx("coin");
      }
    }
    obstacles = obstacles.filter((o) => o.x + OBS_W > -4);
    const last = obstacles[obstacles.length - 1];
    if (!last || last.x < w - SPACING) spawn((last ? last.x : w) + SPACING);

    // Collisions: ground / ceiling / either half of any nearby pair.
    if (kiteY + KITE_R >= floorY || kiteY - KITE_R <= 0) return gameOver();
    for (const o of obstacles) {
      const withinX = kiteX + KITE_R > o.x && kiteX - KITE_R < o.x + OBS_W;
      if (!withinX) continue;
      const topGap = o.gapY - GAP / 2;
      const botGap = o.gapY + GAP / 2;
      if (kiteY - KITE_R < topGap || kiteY + KITE_R > botGap) return gameOver();
    }
  }

  // ── Rendering ──
  function drawKite(y: number, angle: number) {
    ctx.save();
    ctx.translate(kiteX, y);
    ctx.rotate(angle);
    // Tail — a wavy line trailing behind and below the kite.
    ctx.strokeStyle = palette.pink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, KITE_R);
    ctx.quadraticCurveTo(-8, KITE_R + 12, 4, KITE_R + 22);
    ctx.stroke();
    // Body — a rounded square rotated 45° reads as a diamond kite.
    ctx.rotate(Math.PI / 4);
    const s = KITE_R * 1.5;
    roundRect(ctx, -s / 2, -s / 2, s, s, 4, palette.marigold);
    // Cross-spar detail so it reads as a kite, not a plain square.
    ctx.strokeStyle = "rgba(36,31,61,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s / 2, 0);
    ctx.lineTo(s / 2, 0);
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(0, s / 2);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);

    // Obstacle pairs — teal columns above and below each gap.
    for (const o of obstacles) {
      const topGap = o.gapY - GAP / 2;
      const botGap = o.gapY + GAP / 2;
      roundRect(ctx, o.x, 0, OBS_W, topGap, 10, palette.teal);
      roundRect(ctx, o.x, botGap, OBS_W, floorY - botGap, 10, palette.teal);
    }

    // Ground strip + edge line.
    roundRect(ctx, 0, floorY, w, GROUND_H, 0, palette.board);
    ctx.strokeStyle = palette.cream;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(w, floorY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Kite — bob in the ready state; otherwise tilt with vertical velocity.
    const y = state === "ready" ? kiteY + Math.sin(bob) * 8 : kiteY;
    const angle = state === "ready" ? 0 : Math.max(-0.5, Math.min(0.9, vel / 700));
    drawKite(y, angle);

    // "Tap to start" hint while waiting.
    if (state === "ready") {
      ctx.fillStyle = palette.cream;
      ctx.font = "600 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Tap to fly 🪁", w / 2, h * 0.24);
    }
  }

  gc.run((dt) => {
    const step = Math.min(dt, 0.03);
    if (state === "play") update(step);
    else if (state === "ready") bob += dt * 3;
    render();
  });

  reset();
  return () => gc.destroy();
}
