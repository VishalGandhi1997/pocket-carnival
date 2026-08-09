// Chamak — glow-pad memory. Six rangoli petals around a centre diya light
// up in a sequence; watch the pattern, then tap it back in the same order.
// Higher levels start with longer patterns and play them back faster.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const PADS = 6;
const LIVES = 3;
const LEAD = 0.6; // quiet beat before each playback begins
// Audible variety: pads cycle through four different brand tones.
const PAD_SFX = ["tick", "pop", "coin", "clear"] as const;

const startLenFor = (level: number) => 2 + Math.min(level, 6);

export function mountChamak(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Steps", "Best"]);
  let level = sdk.getLevel("chamak");
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  // Flower layout: 6 petals on a hexagon ring around the centre glow.
  const cx = gc.w / 2;
  const cy = gc.h / 2 + gc.w * 0.02;
  const ringR = gc.w * 0.3;
  const padR = gc.w * 0.105;
  const padXY = (i: number): [number, number] => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR];
  };

  let seq: number[] = [];
  let phase: "watch" | "input" | "over" = "watch";
  let playIdx = 0; // playback cursor (watch phase)
  let inputIdx = 0; // how many taps matched so far
  let score = 0;
  let lives = LIVES;
  let target = startLenFor(level) + 4;
  let leveledUp = false;
  let t = 0; // playback accumulator (no setInterval)
  let time = 0; // global clock for breathing/shimmer
  const glow = new Array<number>(PADS).fill(0);
  let wrong: { pad: number; t: number } | null = null;

  // Higher level → snappier playback.
  const gap = () => Math.max(0.28, 0.65 - level * 0.04);

  function startWatch() {
    phase = "watch";
    playIdx = 0;
    t = gap() - LEAD;
    glow.fill(0);
  }

  function reset() {
    level = sdk.getLevel("chamak");
    const startLen = startLenFor(level);
    target = startLen + 4;
    seq = Array.from({ length: startLen }, () => Math.floor(Math.random() * PADS));
    score = 0;
    lives = LIVES;
    leveledUp = false;
    wrong = null;
    hud.set("Level", level);
    hud.set("Steps", 0);
    hud.set("Best", sdk.getBest("chamak"));
    startWatch();
  }

  function light(pad: number) {
    glow[pad] = 1; // glow + scale pulse both render from this value
    sdk.sfx(PAD_SFX[pad % PAD_SFX.length]);
  }

  function completeSequence() {
    score = seq.length; // steps correctly reproduced this run
    hud.set("Steps", score);
    if (!leveledUp && score >= target) {
      leveledUp = true;
      level += 1;
      sdk.setLevel("chamak", level);
      hud.set("Level", level);
      sdk.sfx("clear");
    }
    seq.push(Math.floor(Math.random() * PADS)); // one step longer…
    startWatch(); // …and replay
  }

  function gameOver() {
    phase = "over";
    sdk.haptic(60);
    const isBest = sdk.submitScore("chamak", score);
    const coins = sdk.scaleReward(Math.max(1, score), level);
    sdk.addCoins(coins, "Chamak");
    hud.set("Best", sdk.getBest("chamak"));
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Lights Out! 🔆",
      subtitle: leveledUp
        ? `Now Level ${level} — longer, faster patterns`
        : `${score} steps · reach ${target} to level up`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.onDown((p) => {
    if (phase !== "input") return;
    let pad = -1;
    for (let i = 0; i < PADS; i++) {
      const [x, y] = padXY(i);
      if (Math.hypot(p.x - x, p.y - y) <= padR * 1.3) pad = i;
    }
    if (pad < 0) return;
    if (pad === seq[inputIdx]) {
      light(pad); // correct: flash + tone
      sdk.haptic();
      inputIdx += 1;
      if (inputIdx >= seq.length) completeSequence();
    } else {
      wrong = { pad, t: 0.55 };
      lives -= 1;
      sdk.haptic(60);
      if (lives <= 0) gameOver();
      else startWatch(); // a life lost — the SAME sequence replays
    }
  });

  gc.run((dt) => {
    time += dt;
    // ── sequence playback, accumulator-driven ──
    if (phase === "watch") {
      t += dt;
      if (t >= gap()) {
        t -= gap();
        if (playIdx < seq.length) light(seq[playIdx++]);
        else {
          phase = "input";
          inputIdx = 0;
        }
      }
    }
    const fade = dt / Math.max(0.3, gap() * 0.85);
    for (let i = 0; i < PADS; i++) glow[i] = Math.max(0, glow[i] - fade);
    if (wrong && (wrong.t -= dt) <= 0) wrong = null;

    // ── draw ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // faint outer ring + rangoli dots between the petals
    ctx.beginPath();
    ctx.arc(cx, cy, ringR + padR + 10, 0, 7);
    ctx.strokeStyle = "rgba(255,248,236,0.08)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let i = 0; i < PADS; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3 + Math.PI / 6;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, 3, 0, 7);
      ctx.fillStyle = "rgba(255,248,236,0.22)";
      ctx.fill();
    }

    // centre diya — breathing glow that shows the current pattern length
    const pulse = 1 + Math.sin(time * 2.2) * 0.05;
    const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, ringR * 0.5);
    cg.addColorStop(0, "rgba(255,159,28,0.45)");
    cg.addColorStop(1, "rgba(255,159,28,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 0.5, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, padR * 0.72 * pulse, 0, 7);
    ctx.fillStyle = palette.marigold;
    ctx.fill();
    ctx.fillStyle = palette.ink;
    ctx.font = `700 ${Math.round(gc.w * 0.055)}px system-ui, sans-serif`;
    ctx.fillText(String(seq.length), cx, cy + 1);

    // the six glow pads
    for (let i = 0; i < PADS; i++) {
      const [x, y] = padXY(i);
      const g = glow[i];
      const r = padR * (1 + Math.sin(time * 1.6 + i) * 0.015) * (1 + g * 0.18);
      const col = palette.pieces[i];
      ctx.save();
      if (g > 0.02) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 34 * g;
      }
      ctx.globalAlpha = 0.32 + g * 0.68;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      ctx.beginPath(); // rim so unlit pads still read as buttons
      ctx.arc(x, y, r, 0, 7);
      ctx.strokeStyle = "rgba(255,248,236,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (wrong && wrong.pad === i) {
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, 7);
        ctx.strokeStyle = `rgba(239,71,111,${(wrong.t / 0.55).toFixed(2)})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }

    // status line + lives
    if (phase !== "over") {
      ctx.fillStyle = palette.cream;
      ctx.font = `600 ${Math.round(gc.w * 0.05)}px system-ui, sans-serif`;
      ctx.fillText(phase === "watch" ? "👀 Watch…" : "👆 Your turn", cx, gc.w * 0.075);
      ctx.font = `${Math.round(gc.w * 0.042)}px system-ui, sans-serif`;
      ctx.fillText("❤️".repeat(lives) + "🖤".repeat(LIVES - lives), cx, gc.h - gc.w * 0.065);
    }
  });

  reset();
  return () => gc.destroy();
}
