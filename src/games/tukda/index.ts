// Jigsaw Scenes — square-tile jigsaw over a procedurally painted landscape.
// Every round paints a fresh scene (sky gradient, glowing sun/moon, hills,
// water, stars) on an offscreen canvas, slices it into tiles, and scatters
// them in a tray. Completing a picture levels up: 3×3 → 4×4 → 5×5 tiles, and
// from Level 4 pieces must be dropped more precisely to snap.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

// ── Level curve ──
const gridFor = (level: number) => (level <= 2 ? 3 : level <= 5 ? 4 : 5);
// px from the correct slot centre that counts as placed (tighter from L4)
const snapFor = (level: number) => (level >= 4 ? 18 : 30);
const RES = 2; // offscreen supersampling so tiles stay crisp on retina
const TRAY_SCALE = 0.8; // loose pieces render smaller until placed/dragged

interface ScenePalette {
  skyTop: string;
  skyBottom: string;
  orb: string; // sun / moon fill
  glow: string; // "r,g,b" for the orb's radial glow
  hills: string[];
  water: string;
  ripple: string;
  star: string;
}

const SCENES: ScenePalette[] = [
  { // sunset: orange → pink
    skyTop: "#ff9d3f", skyBottom: "#f45b8b", orb: "#fff3c4", glow: "255,220,150",
    hills: ["#b7477a", "#7d3568", "#4a2352"], water: "#d94f7e", ripple: "#ffd9a8", star: "#fff6dd",
  },
  { // night: indigo → violet
    skyTop: "#1b1b4d", skyBottom: "#6a3aa2", orb: "#f4f1ff", glow: "205,190,255",
    hills: ["#4a2f7a", "#33205c", "#201540"], water: "#3c2a72", ripple: "#b9a5ec", star: "#ffffff",
  },
  { // dawn: teal → gold
    skyTop: "#0f7a8a", skyBottom: "#ffd166", orb: "#fff8e0", glow: "255,240,190",
    hills: ["#0d5c6d", "#0a4655", "#083540"], water: "#0e6a7c", ripple: "#ffe9b0", star: "#eafffb",
  },
];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Piece {
  row: number; // correct slot
  col: number;
  x: number; // current centre, CSS px
  y: number;
  locked: boolean;
}

export function mountTukda(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Placed", "Time"]);
  const gc = createGameCanvas(host, 1.5); // board on top, tray below
  const { ctx, w, h } = gc;

  // Board geometry depends on the level's tile grid, recomputed each round.
  let level = sdk.getLevel("tukda");
  let GRID = gridFor(level);
  let snap = snapFor(level);
  let S = 0; // board size, divisible by GRID
  let cell = 0; // full on-screen tile size
  let src = 0; // tile size inside the offscreen bitmap
  let boardX = 0;
  const boardY = 14;
  let trayTop = 0;

  // ── Offscreen picture, repainted with fresh randomness every round ──
  const off = document.createElement("canvas");
  const octx = off.getContext("2d")!;

  function layout() {
    S = Math.floor((w * 0.9) / GRID) * GRID;
    cell = S / GRID;
    src = cell * RES;
    boardX = (w - S) / 2;
    trayTop = boardY + S + 12;
    off.width = S * RES; // resizing also clears the bitmap + transform
    off.height = S * RES;
  }

  function paintScene() {
    octx.setTransform(RES, 0, 0, RES, 0, 0); // paint in S-space
    const pal = SCENES[Math.floor(Math.random() * SCENES.length)];
    const waterY = S * rnd(0.68, 0.76);
    // sky gradient
    const sky = octx.createLinearGradient(0, 0, 0, waterY);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyBottom);
    octx.fillStyle = sky;
    octx.fillRect(0, 0, S, S);
    // sun / moon with a soft radial glow
    const ox = rnd(S * 0.22, S * 0.78);
    const oy = rnd(S * 0.16, S * 0.4);
    const orr = rnd(S * 0.08, S * 0.13);
    const glow = octx.createRadialGradient(ox, oy, orr * 0.3, ox, oy, orr * 2.6);
    glow.addColorStop(0, `rgba(${pal.glow},0.75)`);
    glow.addColorStop(1, `rgba(${pal.glow},0)`);
    octx.fillStyle = glow;
    octx.fillRect(ox - orr * 3, oy - orr * 3, orr * 6, orr * 6);
    octx.beginPath();
    octx.arc(ox, oy, orr, 0, Math.PI * 2);
    octx.fillStyle = pal.orb;
    octx.fill();
    // scattered stars (hills drawn after will naturally occlude some)
    const stars = 5 + Math.floor(Math.random() * 4);
    octx.fillStyle = pal.star;
    for (let i = 0; i < stars; i++) {
      octx.globalAlpha = rnd(0.5, 1);
      octx.beginPath();
      octx.arc(rnd(0, S), rnd(0, waterY * 0.55), rnd(1.2, 2.6), 0, Math.PI * 2);
      octx.fill();
    }
    octx.globalAlpha = 1;
    // 2-3 layered hill silhouettes — triangles or domes
    const layers = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < layers; i++) {
      octx.fillStyle = pal.hills[i];
      const peakX = rnd(S * 0.15, S * 0.85);
      const rise = rnd(S * 0.16, S * 0.36) * (1 - i * 0.22);
      const half = rnd(S * 0.3, S * 0.55);
      octx.beginPath();
      if (Math.random() < 0.5) {
        octx.moveTo(peakX - half, waterY);
        octx.lineTo(peakX, waterY - rise);
        octx.lineTo(peakX + half, waterY);
        octx.closePath();
      } else {
        octx.ellipse(peakX, waterY, half, rise, 0, Math.PI, 0);
      }
      octx.fill();
    }
    // water band with 3-4 light ripple strokes
    octx.fillStyle = pal.water;
    octx.fillRect(0, waterY, S, S - waterY);
    const ripples = 3 + Math.floor(Math.random() * 2);
    octx.strokeStyle = pal.ripple;
    octx.lineWidth = 2;
    for (let i = 0; i < ripples; i++) {
      const ry = rnd(waterY + 8, S - 8);
      const rx = rnd(0, S * 0.5);
      octx.globalAlpha = rnd(0.35, 0.7);
      octx.beginPath();
      octx.moveTo(rx, ry);
      octx.lineTo(rx + rnd(S * 0.18, S * 0.45), ry);
      octx.stroke();
    }
    octx.globalAlpha = 1;
  }

  let pieces: Piece[] = []; // draw order = array order (last renders on top)
  let drag: { pc: Piece; dx: number; dy: number } | null = null;
  let placed = 0;
  let done = false;
  let startT = 0;

  function reset() {
    level = sdk.getLevel("tukda");
    GRID = gridFor(level);
    snap = snapFor(level);
    layout();
    paintScene();
    placed = 0;
    done = false;
    drag = null;
    startT = performance.now();
    const half = (cell * TRAY_SCALE) / 2;
    pieces = [];
    for (let row = 0; row < GRID; row++)
      for (let col = 0; col < GRID; col++)
        pieces.push({
          row, col,
          x: rnd(half + 6, w - half - 6),
          y: rnd(trayTop + half + 4, h - half - 10),
          locked: false,
        });
    pieces.sort(() => Math.random() - 0.5); // random stacking order too
    hud.set("Level", level);
    hud.set("Placed", `0/${GRID * GRID}`);
    hud.set("Time", "0s");
  }

  const slotCX = (pc: Piece) => boardX + (pc.col + 0.5) * cell;
  const slotCY = (pc: Piece) => boardY + (pc.row + 0.5) * cell;

  // ── Input: drag the topmost loose piece under the pointer ──
  gc.onDown((p) => {
    if (done) return;
    const half = (cell * TRAY_SCALE) / 2;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const pc = pieces[i];
      if (pc.locked) continue;
      if (Math.abs(p.x - pc.x) <= half && Math.abs(p.y - pc.y) <= half) {
        pieces.splice(i, 1);
        pieces.push(pc); // bring to top while dragging
        drag = { pc, dx: pc.x - p.x, dy: pc.y - p.y };
        return;
      }
    }
  });
  gc.onMove((p) => {
    if (!drag) return;
    drag.pc.x = p.x + drag.dx;
    drag.pc.y = p.y + drag.dy;
  });
  gc.onUp(() => {
    if (!drag) return;
    const pc = drag.pc;
    drag = null;
    if (Math.hypot(pc.x - slotCX(pc), pc.y - slotCY(pc)) <= snap) {
      pc.x = slotCX(pc);
      pc.y = slotCY(pc);
      pc.locked = true;
      placed++;
      hud.set("Placed", `${placed}/${GRID * GRID}`);
      sdk.sfx("pop");
      sdk.haptic(25);
      if (placed === GRID * GRID) win();
    }
  });

  function win() {
    done = true;
    const seconds = Math.max(1, Math.round((performance.now() - startT) / 1000));
    // Par grows with piece count so bigger puzzles aren't penalised for time.
    const par = GRID * GRID * 20 + 120;
    const score = Math.max(20, par - seconds * 2);
    const isBest = sdk.submitScore("tukda", score);
    const prevGrid = GRID;
    level += 1;
    sdk.setLevel("tukda", level);
    hud.set("Level", level);
    const coins = sdk.scaleReward(Math.max(3, Math.floor(score / 25)), level);
    sdk.addCoins(coins, "Jigsaw Scenes");
    sdk.sfx("clear");
    const g = gridFor(level);
    const harder =
      g > prevGrid
        ? `${g * g} pieces (${g}×${g})`
        : level === 4
          ? "pieces snap only when dropped precisely"
          : `${g * g} pieces, bigger coins`;
    showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Picture perfect in ${seconds}s · Level ${level} — ${harder}`,
      coins,
      isBest,
      primaryLabel: "New Puzzle",
      onPrimary: reset,
    });
  }

  function drawPiece(pc: Piece, scale: number) {
    const d = cell * scale;
    ctx.drawImage(off, pc.col * src, pc.row * src, src, src, pc.x - d / 2, pc.y - d / 2, d, d);
    ctx.strokeStyle = pc.locked ? "rgba(255,255,255,0.15)" : "rgba(255,248,236,0.85)";
    ctx.lineWidth = pc.locked ? 1 : 2;
    ctx.strokeRect(pc.x - d / 2, pc.y - d / 2, d, d);
  }

  // ── Render ──
  gc.run(() => {
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);
    // board backdrop + dashed outlines on still-empty slots
    roundRect(ctx, boardX - 6, boardY - 6, S + 12, S + 12, 12, palette.board);
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = "rgba(255,248,236,0.35)";
    ctx.lineWidth = 1.5;
    for (const pc of pieces)
      if (!pc.locked)
        ctx.strokeRect(slotCX(pc) - cell / 2 + 2, slotCY(pc) - cell / 2 + 2, cell - 4, cell - 4);
    ctx.setLineDash([]);
    // locked tiles sit in the board; loose tiles stack in z-order above
    for (const pc of pieces) if (pc.locked) drawPiece(pc, 1);
    for (const pc of pieces)
      if (!pc.locked) drawPiece(pc, drag && drag.pc === pc ? 1 : TRAY_SCALE);
    if (!done) hud.set("Time", `${Math.floor((performance.now() - startT) / 1000)}s`);
  });

  reset();
  return () => gc.destroy();
}
