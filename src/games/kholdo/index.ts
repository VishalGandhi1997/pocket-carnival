// Unbolt — unscrew-the-plates dependency puzzle. Stacked plates are each
// held by 2-3 bolts; a bolt unscrews only while NO higher plate covers it,
// so the pile must come apart top-down. A plate with no bolts left drops
// away, uncovering what it pinned. Clear every plate to finish the level.
// No physics engine — plates are rotated rounded-rects (centre + angle);
// all interaction is plain 2D transform maths, commented at each site.
import { createGameCanvas, palette, roundRect, type Pointer } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

interface Bolt {
  lx: number; // fixed offset from the plate centre, in the plate's LOCAL
  ly: number; // (unrotated) space — world position derives from these
  removed: boolean;
}

interface Plate {
  cx: number; // world-space centre
  cy: number;
  w: number; // full size in local space
  h: number;
  angle: number; // rotation in radians (±20°)
  color: string;
  z: number; // stacking order — higher z draws later, i.e. lies on top
  bolts: Bolt[];
  falling: boolean; // all bolts removed → animating off-screen
  vy: number; // fall speed, px/s
  spin: number; // slight tumble while falling, rad/s
  flash: number; // seconds left of the red "blocked!" flash
}

const MAX_TILT = (20 * Math.PI) / 180; // ±20° plate rotation
const FLASH_T = 0.35; // blocked-flash duration (s)

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function mountKholDo(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Bolts"]);
  const gc = createGameCanvas(host, 1.3);
  const { ctx } = gc;
  const BR = Math.max(9, gc.w * 0.027); // bolt head radius (css px)

  let level = sdk.getLevel("kholdo");
  let plates: Plate[] = []; // kept sorted by z ascending (draw order)
  let plateCount = 0; // P for this round — drives score/coins
  let moves = 0; // successful removals only; blocked taps don't count
  let won = false;

  // ── Transform helpers ────────────────────────────────────────────────
  // Local→world: rotate the bolt's local offset by +angle, then translate
  // by the plate centre. This is exactly what ctx.translate + ctx.rotate do
  // when drawing, so hit-tests and pixels always agree.
  //   wx = cx + lx·cos a − ly·sin a
  //   wy = cy + lx·sin a + ly·cos a
  function boltWorld(p: Plate, b: Bolt): Pointer {
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    return { x: p.cx + b.lx * c - b.ly * s, y: p.cy + b.lx * s + b.ly * c };
  }

  // World→local (inverse): translate the point so the plate centre is the
  // origin, then rotate by −angle. In local space the plate is an
  // axis-aligned rect, so containment is a simple half-extent test.
  //   lx = dx·cos(−a) − dy·sin(−a) =  dx·cos a + dy·sin a
  //   ly = dx·sin(−a) + dy·cos(−a) = −dx·sin a + dy·cos a
  function plateContains(p: Plate, x: number, y: number): boolean {
    const dx = x - p.cx, dy = y - p.cy;
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    const lx = dx * c + dy * s;
    const ly = -dx * s + dy * c;
    return Math.abs(lx) <= p.w / 2 && Math.abs(ly) <= p.h / 2;
  }

  /** Topmost still-standing plate with higher z covering this world point
   *  (null → the bolt there is free to unscrew). */
  function coveringPlate(p: Plate, wx: number, wy: number): Plate | null {
    let top: Plate | null = null;
    for (const q of plates)
      if (!q.falling && q.z > p.z && plateContains(q, wx, wy) && (!top || q.z > top.z)) top = q;
    return top;
  }

  const boltsLeft = () =>
    plates.reduce((n, p) => n + p.bolts.filter((b) => !b.removed).length, 0);

  // ── Level generation ─────────────────────────────────────────────────
  function reset() {
    level = sdk.getLevel("kholdo");
    plateCount = Math.min(3 + level, 8);
    moves = 0;
    won = false;
    plates = [];
    for (let i = 0; i < plateCount; i++) {
      const w = gc.w * rand(0.35, 0.55);
      const h = gc.w * rand(0.3, 0.5);
      const angle = rand(-MAX_TILT, MAX_TILT);
      // Keep the whole ROTATED rect on-canvas: a rect rotated by a has
      // half-extents ex = w/2·|cos a| + h/2·|sin a| (and ey symmetrically),
      // so clamp the centre inside those margins.
      const ex = (w / 2) * Math.abs(Math.cos(angle)) + (h / 2) * Math.abs(Math.sin(angle));
      const ey = (w / 2) * Math.abs(Math.sin(angle)) + (h / 2) * Math.abs(Math.cos(angle));
      const p: Plate = {
        cx: rand(ex + 6, gc.w - ex - 6),
        cy: rand(ey + 6, gc.h - ey - 6),
        w, h, angle,
        color: palette.pieces[Math.floor(Math.random() * palette.pieces.length)],
        z: i, // creation index = z; the array stays z-sorted (we only splice)
        bolts: [],
        falling: false, vy: 0, spin: 0, flash: 0,
      };
      // 2-3 bolts at fixed local anchors: the four corners plus the four
      // centre-edge midpoints, inset so heads sit fully on the plate.
      const ix = w / 2 - (BR + 8), iy = h / 2 - (BR + 8);
      const anchors: [number, number][] = [
        [-ix, -iy], [ix, -iy], [-ix, iy], [ix, iy], // corners
        [0, -iy], [0, iy], [-ix, 0], [ix, 0], // centre-edges
      ];
      const n = Math.random() < 0.5 ? 2 : 3;
      for (let k = 0; k < n; k++) {
        // partial Fisher-Yates: pick k-th bolt from the remaining anchors
        const j = k + Math.floor(Math.random() * (anchors.length - k));
        [anchors[k], anchors[j]] = [anchors[j], anchors[k]];
        p.bolts.push({ lx: anchors[k][0], ly: anchors[k][1], removed: false });
      }
      plates.push(p);
    }
    hud.set("Level", level);
    hud.set("Bolts", boltsLeft());
  }

  function win() {
    won = true;
    level += 1;
    sdk.setLevel("kholdo", level);
    const score = plateCount * 30;
    const isBest = sdk.submitScore("kholdo", score);
    const coins = sdk.scaleReward(6 + plateCount * 2, level);
    sdk.addCoins(coins, "Unbolt");
    hud.set("Level", level);
    const nextPlates = Math.min(3 + level, 8);
    showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Cleared in ${moves} moves · Level ${level} — ${nextPlates} plates${nextPlates > plateCount ? ", deeper stack" : ""}`,
      coins,
      isBest,
      mood: "win",
      primaryLabel: `Level ${level} ›`,
      onPrimary: reset,
    });
  }

  // ── Input ────────────────────────────────────────────────────────────
  gc.onDown((pt) => {
    if (won) return;
    // Scan bolts top-of-stack down so the visually topmost one reacts.
    for (let i = plates.length - 1; i >= 0; i--) {
      const p = plates[i];
      if (p.falling) continue;
      for (const b of p.bolts) {
        if (b.removed) continue;
        const bw = boltWorld(p, b);
        const dx = pt.x - bw.x, dy = pt.y - bw.y;
        if (dx * dx + dy * dy > BR * BR * 3.6) continue; // ~1.9·BR tap slack
        const cover = coveringPlate(p, bw.x, bw.y);
        if (cover) {
          cover.flash = FLASH_T; // blocked — flash the plate in the way
          sdk.haptic(30);
        } else {
          b.removed = true;
          moves++;
          sdk.sfx("pop");
          sdk.haptic();
          hud.set("Bolts", boltsLeft());
          if (p.bolts.every((x) => x.removed)) {
            p.falling = true; // last bolt gone → run loop animates the drop
            p.vy = gc.h * 0.6;
            p.spin = rand(-1.2, 1.2);
            sdk.sfx("whoosh");
          }
        }
        return; // one bolt per tap
      }
    }
  });

  // ── Render / animate ─────────────────────────────────────────────────
  function drawPlate(p: Plate) {
    ctx.save();
    // Same local→world mapping as boltWorld(), performed by the canvas:
    // after translate+rotate everything draws in plate-local coordinates
    // with (0,0) at the plate centre.
    ctx.translate(p.cx, p.cy);
    ctx.rotate(p.angle);
    ctx.globalAlpha = 0.85; // translucent so the stacking order reads
    roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 14, p.color);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(36,31,61,0.4)";
    ctx.beginPath();
    ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 14);
    ctx.stroke();
    if (p.flash > 0) { // red "blocked" wash fading out over FLASH_T
      ctx.globalAlpha = (p.flash / FLASH_T) * 0.55;
      roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 14, "#ff3b30");
      ctx.globalAlpha = 1;
    }
    for (const b of p.bolts) {
      if (b.removed) continue;
      const bw = boltWorld(p, b);
      const free = p.falling || !coveringPlate(p, bw.x, bw.y);
      // bolt head: disc + outer ring (marigold ring = free to unscrew)
      ctx.beginPath();
      ctx.arc(b.lx, b.ly, BR, 0, Math.PI * 2);
      ctx.fillStyle = free ? "#e8e6f2" : "#b7b2c9";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = free ? palette.marigold : "rgba(36,31,61,0.55)";
      ctx.stroke();
      // cross slot (screwdriver notch)
      const r = BR * 0.55;
      ctx.beginPath();
      ctx.moveTo(b.lx - r, b.ly); ctx.lineTo(b.lx + r, b.ly);
      ctx.moveTo(b.lx, b.ly - r); ctx.lineTo(b.lx, b.ly + r);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = palette.ink;
      ctx.stroke();
    }
    ctx.restore();
  }

  gc.run((dt) => {
    // Falling plates: accelerate down with a little tumble; delete once the
    // whole plate (centre + half-diagonal) is below the canvas (~0.4s).
    for (let i = plates.length - 1; i >= 0; i--) {
      const p = plates[i];
      if (p.flash > 0) p.flash -= dt;
      if (!p.falling) continue;
      p.vy += gc.h * 5 * dt;
      p.cy += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.cy - Math.hypot(p.w, p.h) / 2 > gc.h) {
        plates.splice(i, 1);
        if (!won && plates.length === 0) win();
      }
    }

    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    // faint workbench grid so bare board still reads as a surface
    ctx.strokeStyle = "rgba(255,248,236,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = gc.w / 8;
    for (let x = step; x < gc.w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, gc.h); }
    for (let y = step; y < gc.h; y += step) { ctx.moveTo(0, y); ctx.lineTo(gc.w, y); }
    ctx.stroke();

    for (const p of plates) drawPlate(p); // ascending z = correct stacking
  });

  reset();
  return () => gc.destroy();
}
