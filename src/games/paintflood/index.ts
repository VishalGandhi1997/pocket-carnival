// Paint Flood — flood-fill puzzle. Your region grows from the top-left
// cell: pick a colour to repaint it and swallow every touching cell of
// that colour. Paint the whole board one colour within the move limit.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const ID = "paintflood";

/** Cells connected to cell 0 through same-colour neighbours, with BFS distance. */
function flood(grid: number[], n: number): Map<number, number> {
  const c = grid[0];
  const dist = new Map<number, number>([[0, 0]]);
  const q = [0];
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % n, y = Math.floor(i / n);
    const nb: number[] = [];
    if (x > 0) nb.push(i - 1);
    if (x < n - 1) nb.push(i + 1);
    if (y > 0) nb.push(i - n);
    if (y < n - 1) nb.push(i + n);
    for (const j of nb) {
      if (!dist.has(j) && grid[j] === c) {
        dist.set(j, dist.get(i)! + 1);
        q.push(j);
      }
    }
  }
  return dist;
}

function paint(grid: number[], n: number, color: number): number[] {
  const next = grid.slice();
  for (const i of flood(grid, n).keys()) next[i] = color;
  return next;
}

/** Greedy solver: each step pick the colour that absorbs the most cells. */
function greedyPar(start: number[], n: number, colors: number): number {
  let g = start;
  let moves = 0;
  while (flood(g, n).size < n * n && moves < 200) {
    let best = g;
    let bestSize = -1;
    for (let c = 0; c < colors; c++) {
      if (c === g[0]) continue;
      const t = paint(g, n, c);
      const s = flood(t, n).size;
      if (s > bestSize) {
        bestSize = s;
        best = t;
      }
    }
    g = best;
    moves++;
  }
  return moves;
}

export function mountPaintFlood(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Moves"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  const controls = document.createElement("div");
  controls.className = "game-controls";
  host.appendChild(controls);

  let level = 1;
  let n = 8;
  let colors = 4;
  let grid: number[] = [];
  let moves = 0;
  let limit = 0;
  let over = false;
  let clock = 0;
  // Per-cell animation: start time and starting scale (1 = no animation).
  let animAt: number[] = [];
  let animFrom: number[] = [];
  let buttons: HTMLButtonElement[] = [];

  function syncButtons() {
    buttons.forEach((b, c) => {
      const active = c === grid[0];
      b.disabled = active || over;
      b.style.opacity = active ? "0.35" : "1";
      b.style.transform = active ? "scale(0.85)" : "scale(1)";
    });
  }

  function buildButtons() {
    controls.innerHTML = "";
    buttons = [];
    for (let c = 0; c < colors; c++) {
      const b = document.createElement("button");
      b.setAttribute("aria-label", `Colour ${c + 1}`);
      b.style.cssText =
        `width:44px;height:44px;border-radius:50%;padding:0;cursor:pointer;` +
        `background:${palette.pieces[c]};border:3px solid ${palette.cream};` +
        `box-shadow:0 3px 0 rgba(0,0,0,0.25);transition:transform .12s,opacity .12s;`;
      b.addEventListener("click", () => pick(c));
      buttons.push(b);
      controls.appendChild(b);
    }
  }

  function reset() {
    level = sdk.getLevel(ID);
    n = Math.min(16, 8 + (level - 1));
    colors = Math.min(7, 4 + Math.floor((level - 1) / 2));
    let par = 0;
    do {
      grid = Array.from({ length: n * n }, () => Math.floor(Math.random() * colors));
      par = greedyPar(grid, n, colors);
    } while (par < 1);
    const slack = Math.max(1.0, 1.35 - (level - 1) * 0.05);
    limit = Math.ceil(par * slack);
    moves = 0;
    over = false;
    animAt = Array(n * n).fill(clock);
    animFrom = Array(n * n).fill(0.6);
    // Opening wave across the whole board.
    for (let i = 0; i < n * n; i++) animAt[i] = clock + ((i % n) + Math.floor(i / n)) * 0.02;
    hud.set("Level", level);
    hud.set("Moves", `0/${limit}`);
    buildButtons();
    syncButtons();
  }

  function pick(c: number) {
    if (over || c === grid[0]) return;
    const before = flood(grid, n);
    grid = paint(grid, n, c);
    const after = flood(grid, n);
    for (const [i, d] of after) {
      animAt[i] = clock + d * 0.025;
      animFrom[i] = before.has(i) ? 0.85 : 0.3;
    }
    moves++;
    hud.set("Moves", `${moves}/${limit}`);
    sdk.haptic();
    if (after.size === n * n) win();
    else if (moves >= limit) lose(after.size);
    syncButtons();
  }

  function win() {
    over = true;
    const coins = sdk.scaleReward(6, level);
    sdk.addCoins(coins, "Paint Flood");
    sdk.submitScore(ID, level);
    sdk.sfx("clear");
    level++;
    sdk.setLevel(ID, level);
    hud.set("Level", level);
    setTimeout(() => {
      if (!host.isConnected) return;
      showOverlay(gc.canvas, {
        title: "⬆️ Level Up!",
        subtitle: `Level ${level} — bigger board`,
        coins,
        mood: "win",
        primaryLabel: `Level ${level} ›`,
        onPrimary: reset,
      });
    }, 550);
  }

  function lose(filled: number) {
    over = true;
    sdk.submitScore(ID, level);
    const pct = Math.floor((filled / (n * n)) * 100);
    setTimeout(() => {
      if (!host.isConnected) return;
      showOverlay(gc.canvas, {
        title: "Out of Moves",
        subtitle: `${pct}% filled · fill it all in ${limit} moves for Level ${level + 1}`,
        mood: "lose",
        primaryLabel: "Try Again",
        onPrimary: reset,
      });
    }, 400);
  }

  gc.run((dt) => {
    clock += dt;
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const pad = 14;
    const size = gc.w - pad * 2;
    const cell = size / n;
    roundRect(ctx, pad - 4, pad - 4, size + 8, size + 8, 12, palette.board);
    const gap = Math.max(1, cell * 0.06);
    for (let i = 0; i < grid.length; i++) {
      const t = Math.min(1, Math.max(0, (clock - animAt[i]) / 0.22));
      const e = 1 - (1 - t) * (1 - t);
      const s = animFrom[i] + (1 - animFrom[i]) * e;
      const x = pad + (i % n) * cell + cell / 2;
      const y = pad + Math.floor(i / n) * cell + cell / 2;
      const w = (cell - gap) * s;
      ctx.globalAlpha = 0.35 + 0.65 * e;
      roundRect(ctx, x - w / 2, y - w / 2, w, w, Math.min(6, w * 0.22), palette.pieces[grid[i]]);
    }
    ctx.globalAlpha = 1;
    // Origin marker on the top-left cell.
    ctx.beginPath();
    ctx.arc(pad + cell / 2, pad + cell / 2, Math.max(2.5, cell * 0.14), 0, Math.PI * 2);
    ctx.fillStyle = palette.cream;
    ctx.fill();
  });

  reset();
  return () => gc.destroy();
}
