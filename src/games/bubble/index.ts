// Bubble Burst — classic bubble shooter on a hex-offset grid. Drag to aim,
// release to fire. Land 3+ of the same colour to pop them; bubbles left
// hanging without a path to the ceiling drop for bonus points. A fresh row
// of bubbles presses down every few shots — the run ends when they reach
// the shooter.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const COLS = 9; // bubbles in a non-offset row (offset rows fit 8)
const MAX_COLORS = 6; // palette.pieces[0..5]
const LOSE_ROW = 12, POP_T = 0.3; // lose depth · pop-ring life (s)

// Progressive difficulty (persistent level). L1: 4 colours, 5 starting rows,
// a new row every 7 shots. Each level adds colours / rows / faster pressure,
// all capped. Level up when a run scores ≥ 300 + level×150.
const colorsFor = (level: number) => Math.min(MAX_COLORS, 3 + level);
const shotsPerRowFor = (level: number) => Math.max(3, 7 - Math.floor(level / 2));
const startRowsFor = (level: number) => Math.min(8, 5 + Math.floor((level - 1) / 2));
const levelUpAt = (level: number) => 300 + level * 150;
const AIM_MIN = Math.PI / 12, AIM_MAX = Math.PI - Math.PI / 12; // aim clamp: 15°–165°

type Cell = number | null; // colour index, or empty
// Transient effect: a falling dropped bubble (drop=true) or an expanding pop ring.
interface Fx { x: number; y: number; vy: number; color: number; t: number; drop: boolean }

export function mountBubble(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Score", "Best"]);
  let level = sdk.getLevel("bubble");
  let nColors = colorsFor(level), shotsPerRow = shotsPerRowFor(level);
  const gc = createGameCanvas(host, 1.4);
  const { ctx, w, h } = gc;

  const R = w / 18; // bubble radius: 9 diameters span the width exactly
  const ROW_H = R * Math.sqrt(3); // vertical pitch of hex packing
  const TOP = R + 4; // y of row-0 centres
  const COLORS = palette.pieces.slice(0, MAX_COLORS);
  const SPEED = w * 2.4; // shot speed (px/s)
  const shooter = { x: w / 2, y: h - R * 2 };

  // ── state ──
  let grid: Cell[][] = []; // grid[row][col]
  let offsetBase = 0; // row r is x-shifted by R iff (r + offsetBase) is odd
  let score = 0, shots = 0, over = false;
  let aim = Math.PI / 2; // radians; 0 = right, π/2 = straight up
  let cur = 0, next = 0; // launcher colour + preview colour
  let shot: { x: number; y: number; vx: number; vy: number; color: number } | null = null;
  let fx: Fx[] = [];

  // ── hex-grid geometry ──
  const isOff = (r: number) => (r + offsetBase) % 2 === 1;
  const colsIn = (r: number) => (isOff(r) ? COLS - 1 : COLS);
  const cellX = (r: number, c: number) => R + c * 2 * R + (isOff(r) ? R : 0);
  const cellY = (r: number) => TOP + r * ROW_H;
  const at = (r: number, c: number): Cell =>
    r >= 0 && r < grid.length && c >= 0 && c < grid[r].length ? grid[r][c] : null;

  /** The six hex neighbours of (r,c), respecting offset-row column shifts. */
  function neighbours(r: number, c: number): [number, number][] {
    const s = isOff(r) ? 0 : -1; // column shift when stepping one row up/down
    return [[r, c - 1], [r, c + 1], [r - 1, c + s], [r - 1, c + s + 1], [r + 1, c + s], [r + 1, c + s + 1]];
  }

  function makeRow(r: number, filled: boolean): Cell[] {
    return Array.from({ length: colsIn(r) }, () => (filled ? Math.floor(Math.random() * nColors) : null));
  }

  /** Launcher only deals colours still on the board (any colour if cleared). */
  function rollColor(): number {
    const seen = new Set<number>();
    for (const row of grid) for (const v of row) if (v !== null) seen.add(v);
    const pool = seen.size ? [...seen] : Array.from({ length: nColors }, (_, i) => i);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function reset() {
    level = sdk.getLevel("bubble");
    nColors = colorsFor(level);
    shotsPerRow = shotsPerRowFor(level);
    offsetBase = 0;
    grid = [];
    for (let r = 0; r < startRowsFor(level); r++) grid.push(makeRow(r, true));
    score = 0; shots = 0; over = false; shot = null; fx = [];
    aim = Math.PI / 2;
    cur = rollColor(); next = rollColor();
    hud.set("Level", level);
    hud.set("Score", 0);
    hud.set("Best", sdk.getBest("bubble"));
  }

  /** Nearest empty cell to (x,y), widening the search ring until one exists. */
  function snap(x: number, y: number): [number, number] {
    const r0 = Math.max(0, Math.round((y - TOP) / ROW_H));
    for (let span = 1; ; span++) {
      while (grid.length <= r0 + span) grid.push(makeRow(grid.length, false));
      let best: [number, number] | null = null, bd = Infinity;
      for (let r = Math.max(0, r0 - span); r <= r0 + span; r++)
        for (let c = 0; c < colsIn(r); c++) {
          if (grid[r][c] !== null) continue;
          const d = (cellX(r, c) - x) ** 2 + (cellY(r) - y) ** 2;
          if (d < bd) { bd = d; best = [r, c]; }
        }
      if (best) return best;
    }
  }

  /** BFS flood of the same-colour cluster containing (r0,c0). */
  function cluster(r0: number, c0: number): [number, number][] {
    const color = grid[r0][c0];
    const seen = new Set<number>([r0 * 32 + c0]);
    const out: [number, number][] = [];
    const stack: [number, number][] = [[r0, c0]];
    while (stack.length) {
      const [r, c] = stack.pop()!;
      out.push([r, c]);
      for (const [nr, nc] of neighbours(r, c))
        if (at(nr, nc) === color && !seen.has(nr * 32 + nc)) { seen.add(nr * 32 + nc); stack.push([nr, nc]); }
    }
    return out;
  }

  /** Remove bubbles with no path to the top row (BFS from row 0); returns count. */
  function dropFloaters(): number {
    const seen = new Set<number>(), stack: [number, number][] = [];
    for (let c = 0; c < (grid[0]?.length ?? 0); c++)
      if (grid[0][c] !== null) { seen.add(c); stack.push([0, c]); }
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [nr, nc] of neighbours(r, c))
        if (at(nr, nc) !== null && !seen.has(nr * 32 + nc)) { seen.add(nr * 32 + nc); stack.push([nr, nc]); }
    }
    let n = 0;
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++) {
        const v = grid[r][c];
        if (v !== null && !seen.has(r * 32 + c)) {
          fx.push({ x: cellX(r, c), y: cellY(r), vy: -h * 0.15, color: v, t: 0.9, drop: true });
          grid[r][c] = null; n++;
        }
      }
    return n;
  }

  /** New full row at the top; flipping offsetBase keeps old rows' x stable. */
  function addRow() {
    offsetBase = 1 - offsetBase;
    grid.unshift(makeRow(0, true));
  }

  /** Drop empty trailing rows so grid.length-1 is the deepest occupied row. */
  function trim() {
    while (grid.length && grid[grid.length - 1].every((v) => v === null)) grid.pop();
  }

  function endGame() {
    over = true;
    shot = null;
    const isBest = sdk.submitScore("bubble", score);
    const leveledUp = score >= levelUpAt(level);
    if (leveledUp) {
      level += 1;
      sdk.setLevel("bubble", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 20)), level);
    sdk.addCoins(coins, "Bubble Burst");
    hud.set("Best", sdk.getBest("bubble"));
    hud.set("Level", level);
    const need = levelUpAt(level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Out of Room! 🫧",
      subtitle: leveledUp
        ? `Level ${level} — more colours, rows drop faster`
        : `Score ${score} · ${Math.max(0, need - score)} more for Level ${level + 1}`,
      coins, isBest, mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again", onPrimary: reset,
    });
  }

  /** Glue the landed shot into the grid, then pop / drop / press a new row. */
  function settle(x: number, y: number, color: number) {
    const [r, c] = snap(x, y);
    grid[r][c] = color;
    const cl = cluster(r, c);
    if (cl.length >= 3) {
      for (const [pr, pc] of cl) {
        fx.push({ x: cellX(pr, pc), y: cellY(pr), vy: 0, color, t: POP_T, drop: false });
        grid[pr][pc] = null;
      }
      score += cl.length * 10 + dropFloaters() * 20; // +10 per pop, +20 per dropped floater
      hud.set("Score", score);
      sdk.sfx("clear");
      sdk.haptic(30);
    } else {
      sdk.haptic();
    }
    if (shots % shotsPerRow === 0) addRow(); // every Nth shot (by level) presses a row down
    trim();
    if (grid.length - 1 >= LOSE_ROW) endGame();
  }

  /** True when (x,y) overlaps any grid bubble (small tolerance to nestle). */
  function touching(x: number, y: number): boolean {
    const rr = (2 * R - 2) ** 2;
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === null) continue;
        const dx = cellX(r, c) - x, dy = cellY(r) - y;
        if (dx * dx + dy * dy < rr) return true;
      }
    return false;
  }

  /** Advance the shot in sub-steps (no tunnelling), bounce walls, stick. */
  function moveShot(dt: number) {
    const s = shot;
    if (!s) return;
    const subs = Math.max(1, Math.ceil((SPEED * dt) / (R * 0.5)));
    for (let i = 0; i < subs; i++) {
      s.x += (s.vx * dt) / subs; s.y += (s.vy * dt) / subs;
      if (s.x < R) { s.x = R; s.vx = Math.abs(s.vx); } // left wall
      if (s.x > w - R) { s.x = w - R; s.vx = -Math.abs(s.vx); } // right wall
      if (s.y <= TOP || touching(s.x, s.y)) { // ceiling or grid contact → stick
        shot = null;
        settle(s.x, Math.max(TOP, s.y), s.color);
        return;
      }
    }
  }

  // ── input: drag (or hover) to aim, release to fire ──
  function setAim(p: { x: number; y: number }) {
    const dx = p.x - shooter.x, dy = shooter.y - p.y;
    if (Math.hypot(dx, dy) < R) return; // ignore taps right on the launcher
    aim = Math.min(AIM_MAX, Math.max(AIM_MIN, Math.atan2(dy, dx)));
  }
  gc.onDown(setAim); gc.onMove(setAim);
  gc.onUp(() => {
    if (over || shot) return; // one bubble in flight at a time
    shots++;
    shot = { x: shooter.x, y: shooter.y, vx: Math.cos(aim) * SPEED, vy: -Math.sin(aim) * SPEED, color: cur };
    cur = next; next = rollColor();
    sdk.sfx("pop");
  });

  /** Glossy bubble: colour disc + small white highlight dot. */
  function drawBubble(x: number, y: number, color: string, rad = R, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7);
    ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(x - rad * 0.35, y - rad * 0.35, rad * 0.22, 0, 7);
    ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.fill();
    ctx.globalAlpha = 1;
  }

  gc.run((dt) => {
    if (!over) moveShot(dt);
    for (const f of fx) {
      f.t -= dt;
      if (f.drop) { f.vy += h * 2.6 * dt; f.y += f.vy * dt; } // gravity
    }
    fx = fx.filter((f) => f.t > 0 && f.y < h + R);

    // ── draw ──
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);

    // danger line: bubbles crossing it end the run
    const dangerY = cellY(LOSE_ROW) - R;
    ctx.setLineDash([6, 8]); ctx.strokeStyle = "rgba(239,71,111,0.45)";
    ctx.beginPath(); ctx.moveTo(8, dangerY); ctx.lineTo(w - 8, dangerY); ctx.stroke();
    ctx.setLineDash([]);

    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++) {
        const v = grid[r][c];
        if (v !== null) drawBubble(cellX(r, c), cellY(r), COLORS[v]);
      }

    // pop rings grow + fade; dropped bubbles fall + fade
    for (const f of fx) {
      if (f.drop) drawBubble(f.x, f.y, COLORS[f.color], R, Math.min(1, f.t * 2));
      else drawBubble(f.x, f.y, COLORS[f.color], R * (1 + ((POP_T - f.t) / POP_T) * 0.6), f.t / POP_T);
    }

    // dotted aim guide
    if (!shot && !over) {
      ctx.fillStyle = "rgba(255,248,236,0.55)";
      for (let d = R + 12; d < w * 0.36; d += 14) {
        ctx.beginPath(); ctx.arc(shooter.x + Math.cos(aim) * d, shooter.y - Math.sin(aim) * d, 3, 0, 7); ctx.fill();
      }
    }

    // launcher stand + loaded bubble + "next" preview
    roundRect(ctx, shooter.x - R * 1.4, shooter.y + R * 0.6, R * 2.8, 10, 5, palette.board);
    drawBubble(shooter.x, shooter.y, COLORS[cur]);
    drawBubble(shooter.x + R * 2.8, shooter.y + R * 0.4, COLORS[next], R * 0.55);
    ctx.fillStyle = "rgba(255,248,236,0.6)"; ctx.font = '600 11px "Baloo 2", sans-serif'; ctx.textAlign = "center";
    ctx.fillText("next", shooter.x + R * 2.8, shooter.y + R * 1.5);

    if (shot) drawBubble(shot.x, shot.y, COLORS[shot.color]);

    if (shots === 0 && !over) {
      ctx.fillStyle = "rgba(255,248,236,0.7)"; ctx.font = '700 15px "Baloo 2", sans-serif';
      ctx.fillText("Drag to aim · release to pop 🫧", w / 2, shooter.y - R * 2.2);
    }
  });

  reset();
  return () => gc.destroy();
}
