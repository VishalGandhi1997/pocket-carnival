// Minefield — Minesweeper. Tap to reveal a cell; a 0 flood-fills its region.
// Hit a mine and it's over. Toggle Flag mode to mark suspected mines.
// Clear every safe cell to level up — faster clears score higher. Each level
// grows the grid and packs the mines tighter.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

// ── Level curve ── square grid grows by 1 every 2 levels (8×8 → 12×12) and
// mine density climbs 1.2%/level (12% → 20% cap).
const gridFor = (level: number) => Math.min(12, 8 + Math.floor((level - 1) / 2));
const minesFor = (level: number) => {
  const n = gridFor(level);
  return Math.round(n * n * Math.min(0.2, 0.12 + (level - 1) * 0.012));
};

// Classic per-number colours so counts are readable at a glance.
const NUM_COLORS = ["", "#4cc9f0", "#06d6a0", "#ef476f", "#c77dff", "#ff9f1c", "#4cc9f0", "#fff8ec", "#ffd166"];

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number; // adjacent mine count (0-8)
}

export function mountSurang(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Mines", "Time"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  let level = sdk.getLevel("surang");
  let N = gridFor(level); // grid is N×N
  let MINES = minesFor(level); // mines placed after the first reveal
  let grid: Cell[][] = [];
  let firstTap = true; // mines are generated on the first reveal
  let flagMode = false;
  let flags = 0;
  let elapsed = 0; // whole seconds, advanced by the rAF loop
  let elapsedRaw = 0; // fractional accumulator
  let over = false;

  const pad = 10;
  const cellSize = () => (gc.w - pad * 2) / N;

  function reset() {
    level = sdk.getLevel("surang");
    N = gridFor(level);
    MINES = minesFor(level);
    grid = [];
    for (let y = 0; y < N; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < N; x++) row.push({ mine: false, revealed: false, flagged: false, count: 0 });
      grid.push(row);
    }
    firstTap = true;
    flags = 0;
    elapsed = 0;
    elapsedRaw = 0;
    over = false;
    hud.set("Level", level);
    hud.set("Mines", MINES);
    hud.set("Time", 0);
  }

  // Place mines anywhere except the first-tapped cell and its neighbours
  // (so the first tap always opens a region), then compute counts. The
  // 3×3 safe zone always leaves room: 20% of 8×8 is well under 64 − 9.
  function placeMines(safeX: number, safeY: number) {
    let placed = 0;
    while (placed < MINES) {
      const x = Math.floor(Math.random() * N);
      const y = Math.floor(Math.random() * N);
      if (grid[y][x].mine || (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1)) continue;
      grid[y][x].mine = true;
      placed++;
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (grid[y][x].mine) continue;
        grid[y][x].count = neighbours(x, y).filter(([nx, ny]) => grid[ny][nx].mine).length;
      }
    }
  }

  // Valid in-bounds neighbours of a cell (up to 8).
  function neighbours(x: number, y: number): [number, number][] {
    const out: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < N && ny >= 0 && ny < N) out.push([nx, ny]);
      }
    }
    return out;
  }

  // Flood-fill: reveal this cell and, if it's a 0, its connected 0-region
  // plus the numbered border cells around it.
  function reveal(x: number, y: number) {
    const stack: [number, number][] = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      const c = grid[cy][cx];
      if (c.revealed || c.flagged) continue;
      c.revealed = true;
      if (c.count === 0 && !c.mine) {
        for (const [nx, ny] of neighbours(cx, cy)) {
          if (!grid[ny][nx].revealed) stack.push([nx, ny]);
        }
      }
    }
  }

  // Win when every non-mine cell has been revealed.
  function hasWon(): boolean {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (!grid[y][x].mine && !grid[y][x].revealed) return false;
    return true;
  }

  function loss() {
    over = true;
    // Reveal every mine so the player sees where they were.
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (grid[y][x].mine) grid[y][x].revealed = true;
    sdk.haptic(60);
    sdk.submitScore("surang", 0);
    const coins = 2;
    sdk.addCoins(coins, "Minefield");
    let safeLeft = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (!grid[y][x].mine && !grid[y][x].revealed) safeLeft++;
    showOverlay(gc.canvas, {
      title: "Boom! 💥",
      subtitle: `You lasted ${elapsed}s · ${safeLeft} safe cells left — clear them all to reach Level ${level + 1}`,
      coins,
      mood: "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function win() {
    over = true;
    sdk.sfx("clear");
    // Faster clear = higher score; bigger boards get a larger time budget.
    const score = Math.max(10, 300 + (level - 1) * 40 - elapsed);
    const isBest = sdk.submitScore("surang", score);
    level += 1;
    sdk.setLevel("surang", level);
    hud.set("Level", level);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 20)), level);
    sdk.addCoins(coins, "Minefield");
    const n = gridFor(level);
    showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Cleared in ${elapsed}s · Level ${level} — ${n}×${n} grid, ${minesFor(level)} mines`,
      coins,
      isBest,
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.onDown((p) => {
    if (over) return;
    const size = cellSize();
    const gx = Math.floor((p.x - pad) / size);
    const gy = Math.floor((p.y - pad) / size);
    if (gx < 0 || gx >= N || gy < 0 || gy >= N) return;
    const cell = grid[gy][gx];

    if (flagMode) {
      // Flag mode: toggle a marker; revealed cells can't be flagged.
      if (cell.revealed) return;
      cell.flagged = !cell.flagged;
      flags += cell.flagged ? 1 : -1;
      hud.set("Mines", MINES - flags);
      sdk.sfx("pop");
      return;
    }

    if (cell.flagged || cell.revealed) return; // flagged cells are protected
    if (firstTap) {
      placeMines(gx, gy);
      firstTap = false;
    }
    if (cell.mine) return loss();
    reveal(gx, gy);
    sdk.haptic();
    if (hasWon()) win();
  });

  gc.run((dt) => {
    // Tick the clock only while a run is live and started.
    if (!over && !firstTap) {
      elapsedRaw += dt;
      if (elapsedRaw >= 1) {
        elapsed += Math.floor(elapsedRaw);
        elapsedRaw -= Math.floor(elapsedRaw);
        hud.set("Time", elapsed);
      }
    }

    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const size = cellSize();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const cell = grid[y][x];
        const cx = pad + x * size;
        const cy = pad + y * size;
        const inset = 1.5;
        if (cell.revealed) {
          // Revealed cells sit flush and darker than covered ones.
          const face = cell.mine ? palette.pink : palette.ink;
          roundRect(ctx, cx + inset, cy + inset, size - inset * 2, size - inset * 2, 5, face);
          if (cell.mine) {
            ctx.font = `${size * 0.5}px system-ui`;
            ctx.fillText("💣", cx + size / 2, cy + size / 2 + 1);
          } else if (cell.count > 0) {
            ctx.font = `bold ${size * 0.5}px system-ui`;
            ctx.fillStyle = NUM_COLORS[cell.count];
            ctx.fillText(String(cell.count), cx + size / 2, cy + size / 2 + 1);
          }
        } else {
          // Covered cell — raised board-coloured tile.
          roundRect(ctx, cx + inset, cy + inset, size - inset * 2, size - inset * 2, 5, palette.board);
          roundRect(ctx, cx + inset, cy + inset, size - inset * 2, (size - inset * 2) * 0.45, 5, "rgba(255,248,236,0.08)");
          if (cell.flagged) {
            ctx.font = `${size * 0.5}px system-ui`;
            ctx.fillText("🚩", cx + size / 2, cy + size / 2 + 1);
          }
        }
      }
    }
  });

  // ── Controls ── a flag-mode toggle button, styled active when on.
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const flagBtn = document.createElement("button");
  flagBtn.className = "btn-ghost";
  flagBtn.textContent = "🚩 Flag: Off";
  flagBtn.addEventListener("click", () => {
    flagMode = !flagMode;
    flagBtn.textContent = flagMode ? "🚩 Flag: On" : "🚩 Flag: Off";
    flagBtn.classList.toggle("active", flagMode);
  });
  controls.appendChild(flagBtn);
  host.appendChild(controls);

  reset();
  return () => gc.destroy();
}
