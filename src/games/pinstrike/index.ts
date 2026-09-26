// Pin Strike — tap to throw pins into a spinning disc. Pins stick in the rim
// and ride along; hit a pin already there and it's a fail. Stick every pin
// to clear the stage. Each level is one stage: more pins, more obstacles,
// faster spin, then direction reversals (L3+) and pulsing speed (L6+).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const TAU = Math.PI * 2;
const DOWN = Math.PI / 2; // canvas angle pointing straight down (where pins land)
const MIN_GAP = 0.13; // rad — closer than this at the rim = pins collide
const GEM_GAP = 0.22; // rad — landing this close to the gem collects it
const THROW_SPEED = 1500; // px/s

const pinCount = (l: number) => Math.min(14, 6 + l);
const obstacleCount = (l: number) => Math.min(6, Math.floor((l - 1) / 2));
const spinSpeed = (l: number) => Math.min(3.2, 1.4 + (l - 1) * 0.15);

/** Normalized angular difference in (-π, π]. */
function angDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

interface Stuck { a: number; obst: boolean } // a = angle in disc-local space
interface Bounce { x: number; y: number; vx: number; vy: number; ang: number; va: number }
interface Fx { x: number; y: number; t: number; label: string }

export function mountPinStrike(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Pins"]);
  const gc = createGameCanvas(host, 1.3);
  const { ctx } = gc;
  const cx = gc.w / 2;
  const cy = gc.h * 0.36;
  const R = gc.w * 0.22; // disc radius
  const L = R * 0.75; // pin length (tip in rim → head outside)
  const readyHeadY = gc.h - 34;

  let level = 1;
  let pinsTotal = 0;
  let thrown = 0;
  let placed = 0;
  let stuck: Stuck[] = [];
  let gem: number | null = null;
  let rot = 0;
  let dir = 1;
  let dirMul = 1;
  let flipT = 0;
  let time = 0;
  let flying: number | null = null; // tip y of the pin in flight
  let bounce: Bounce | null = null;
  let hitT = 0; // disc "thunk" nudge
  let endT = 0;
  let phase: "play" | "fail" | "clear" | "done" = "play";
  let shattered = false; // stage cleared → disc cracks apart
  let fx: Fx[] = [];

  function place(gap: number, taken: number[]): number | null {
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.random() * TAU;
      if (Math.abs(angDiff(a, DOWN)) < 0.5) continue; // never right under the first throw
      if (taken.every((t) => Math.abs(angDiff(a, t)) >= gap)) return a;
    }
    return null;
  }

  function reset() {
    level = sdk.getLevel("pinstrike");
    pinsTotal = pinCount(level);
    thrown = 0;
    placed = 0;
    stuck = [];
    const taken: number[] = [];
    for (let i = 0; i < obstacleCount(level); i++) {
      const a = place(0.55, taken);
      if (a !== null) { taken.push(a); stuck.push({ a, obst: true }); }
    }
    gem = place(0.35, taken);
    rot = 0;
    dir = Math.random() < 0.5 ? 1 : -1;
    dirMul = dir;
    flipT = 2 + Math.random() * 2.5;
    time = 0;
    flying = null;
    bounce = null;
    hitT = 0;
    fx = [];
    phase = "play";
    shattered = false;
    hud.set("Level", level);
    hud.set("Pins", pinsTotal);
  }

  gc.onDown(() => {
    if (phase !== "play" || flying !== null || thrown >= pinsTotal) return;
    thrown++;
    flying = readyHeadY - L;
    sdk.haptic(10);
    hud.set("Pins", pinsTotal - thrown);
  });

  function land() {
    flying = null;
    const local = (((DOWN - rot) % TAU) + TAU) % TAU;
    if (stuck.some((s) => Math.abs(angDiff(local, s.a)) < MIN_GAP)) {
      phase = "fail";
      endT = 0.8;
      bounce = { x: cx, y: cy + R + L / 2, vx: (Math.random() - 0.5) * 260, vy: 260, ang: 0, va: 10 };
      sdk.haptic(60);
      sdk.sfx("pop");
      return;
    }
    stuck.push({ a: local, obst: false });
    placed++;
    hitT = 0.1;
    sdk.haptic(20);
    sdk.sfx("tick");
    if (gem !== null && Math.abs(angDiff(local, gem)) < GEM_GAP) {
      gem = null;
      sdk.addCoins(5, "Pin Strike gem");
      sdk.sfx("coin");
      fx.push({ x: cx, y: cy + R + L + 16, t: 0.8, label: "💎 +5" });
    }
    if (placed >= pinsTotal) {
      phase = "clear";
      shattered = true;
      endT = 0.9;
      sdk.sfx("clear");
    }
  }

  function finishClear() {
    const cleared = level;
    level += 1;
    sdk.setLevel("pinstrike", level);
    const coins = sdk.scaleReward(6, cleared);
    sdk.addCoins(coins, "Pin Strike");
    const isBest = sdk.submitScore("pinstrike", cleared);
    hud.set("Level", level);
    const extra = level === 3 ? " & reversals" : level === 6 ? " & surging speed" : "";
    showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Level ${level} — faster spin${extra}`,
      coins,
      isBest,
      mood: "win",
      primaryLabel: "Next Level",
      onPrimary: reset,
    });
  }

  function finishFail() {
    sdk.submitScore("pinstrike", level - 1); // best = highest stage cleared
    const left = pinsTotal - placed;
    showOverlay(gc.canvas, {
      title: "Clang! 📌",
      subtitle: `${left} pin${left === 1 ? "" : "s"} left · Level ${level}`,
      mood: "lose",
      primaryLabel: "Retry",
      onPrimary: reset,
    });
  }

  function drawPin(ang: number, r0: number, color: string, ox = 0, oy = 0) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const hx = cx + ox + c * (r0 + L), hy = cy + oy + s * (r0 + L);
    ctx.beginPath();
    ctx.moveTo(cx + ox + c * r0, cy + oy + s * r0);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = palette.cream;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, 6.5, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  gc.run((dt) => {
    time += dt;
    // ── update ──
    if (phase === "play" || phase === "fail") {
      if (level >= 3) {
        flipT -= dt;
        if (flipT <= 0) { dir = -dir; flipT = 2 + Math.random() * 2.5; }
      }
      dirMul += (dir - dirMul) * Math.min(1, dt * 4);
      let sp = spinSpeed(level);
      if (level >= 6) sp *= 1 + 0.45 * Math.sin(time * 1.4);
      rot = (rot + sp * dirMul * dt) % TAU;
    }
    if (flying !== null) {
      flying -= THROW_SPEED * dt;
      if (flying <= cy + R) land();
    }
    if (bounce) {
      bounce.vy += 1100 * dt;
      bounce.x += bounce.vx * dt;
      bounce.y += bounce.vy * dt;
      bounce.ang += bounce.va * dt;
    }
    if (hitT > 0) hitT -= dt;
    fx = fx.filter((f) => (f.t -= dt) > 0);
    if (phase === "fail" || phase === "clear") {
      endT -= dt;
      if (endT <= 0) {
        const wasClear = phase === "clear";
        phase = "done";
        if (wasClear) finishClear(); else finishFail();
      }
    }

    // ── draw ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const burst = shattered ? Math.min(1, (0.9 - endT) / 0.9) : 0;
    const oy = hitT > 0 ? -4 : 0;
    // stuck pins (drawn under the disc so the tips sink into the wood)
    ctx.globalAlpha = 1 - burst;
    for (const s of stuck) {
      const ang = s.a + rot;
      drawPin(ang, R - 6 + burst * 160, s.obst ? palette.pink : palette.marigold, 0, oy);
    }
    ctx.globalAlpha = 1;
    if (burst >= 1) {
      // disc fully shattered — nothing left to draw
    } else if (burst > 0) {
      // disc cracks into four wedges flying outward
      ctx.globalAlpha = 1 - burst;
      for (let k = 0; k < 4; k++) {
        const a0 = rot + (k * TAU) / 4;
        const mid = a0 + TAU / 8;
        const ox = Math.cos(mid) * burst * 120, py = Math.sin(mid) * burst * 120;
        ctx.beginPath();
        ctx.moveTo(cx + ox, cy + py);
        ctx.arc(cx + ox, cy + py, R, a0, a0 + TAU / 4);
        ctx.closePath();
        ctx.fillStyle = "#a0673a";
        ctx.fill();
        ctx.strokeStyle = palette.sky;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      // wooden disc with neon rim and grain marks that show the spin
      const g = ctx.createRadialGradient(cx, cy + oy, R * 0.1, cx, cy + oy, R);
      g.addColorStop(0, "#c98a4b");
      g.addColorStop(1, "#8a5528");
      ctx.save();
      ctx.shadowColor = palette.sky;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy + oy, R, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = palette.sky;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(60,30,10,0.35)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const a = rot + (k * TAU) / 6;
        ctx.beginPath();
        ctx.arc(cx, cy + oy, R * (0.35 + (k % 3) * 0.18), a, a + 0.8);
        ctx.stroke();
      }
      if (gem !== null) {
        const ga = gem + rot;
        ctx.font = "20px system-ui, sans-serif";
        ctx.fillText("💎", cx + Math.cos(ga) * (R + 12), cy + oy + Math.sin(ga) * (R + 12));
      }
      ctx.fillStyle = palette.cream;
      ctx.font = "bold 26px system-ui, sans-serif";
      ctx.fillText(String(pinsTotal - placed), cx, cy + oy);
    }
    // pin in flight, or the next pin waiting at the bottom
    const drawVertical = (tipY: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.lineTo(cx, tipY + L);
      ctx.strokeStyle = palette.cream;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, tipY + L, 6.5, 0, TAU);
      ctx.fillStyle = palette.teal;
      ctx.fill();
    };
    if (flying !== null) drawVertical(flying);
    else if (phase === "play" && thrown < pinsTotal) drawVertical(readyHeadY - L);
    if (bounce) {
      ctx.save();
      ctx.translate(bounce.x, bounce.y);
      ctx.rotate(bounce.ang);
      ctx.fillStyle = palette.pink;
      ctx.fillRect(-1.5, -L / 2, 3, L);
      ctx.beginPath();
      ctx.arc(0, L / 2, 6.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // remaining-pins stack at left
    for (let i = 0; i < pinsTotal - thrown; i++) {
      const y = gc.h - 24 - i * 16;
      ctx.fillStyle = "rgba(255,248,236,0.7)";
      ctx.fillRect(16, y - 5, 12, 2.5);
      ctx.beginPath();
      ctx.arc(30, y - 4, 4, 0, TAU);
      ctx.fillStyle = palette.teal;
      ctx.fill();
    }
    for (const f of fx) {
      ctx.globalAlpha = Math.min(1, f.t / 0.4);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText(f.label, f.x, f.y - (0.8 - f.t) * 30);
      ctx.globalAlpha = 1;
    }
  });

  reset();
  return () => gc.destroy();
}
