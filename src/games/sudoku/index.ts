// Sudoku Sadhana — classic 9×9 Sudoku. Tap an empty cell to select it, then
// tap a number on the pad to fill it. Conflicting digits glow red. Solve the
// whole grid (matching the generated solution) to win.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const N = 9; // board size
const BLANKS = 45; // cells to blank out when building the puzzle

/** Fisher–Yates shuffle of [1..9], returned as a fresh array. */
function shuffledDigits(): number[] {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** True if placing `val` at (row,col) breaks no row/col/box rule in `grid`. */
function canPlace(grid: number[], row: number, col: number, val: number): boolean {
  for (let k = 0; k < N; k++) {
    if (grid[row * N + k] === val) return false; // row
    if (grid[k * N + col] === val) return false; // column
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (grid[(br + r) * N + (bc + c)] === val) return false; // 3×3 box
  return true;
}

/** Randomized backtracking fill of a complete valid solution. Always
 *  terminates: each cell is tried in order and unwinds on dead ends. */
function fillGrid(grid: number[], pos = 0): boolean {
  if (pos === N * N) return true; // filled every cell
  const row = Math.floor(pos / N);
  const col = pos % N;
  for (const val of shuffledDigits()) {
    if (canPlace(grid, row, col, val)) {
      grid[pos] = val;
      if (fillGrid(grid, pos + 1)) return true;
      grid[pos] = 0; // backtrack
    }
  }
  return false;
}

export function mountSudoku(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Filled", "Mistakes"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  let solution: number[] = []; // the completed grid we validate against
  let puzzle: number[] = []; // current player state (0 = empty)
  let given: boolean[] = []; // true = fixed clue, not editable
  let selected = -1; // index of selected cell, or -1
  let mistakesMade = 0; // wrong entries placed this puzzle (drives score)
  let solved = false;

  // ── Board geometry (square board centred with a small margin) ──
  const margin = 12;
  const boardSize = gc.w - margin * 2;
  const cell = boardSize / N;
  const boardTop = (gc.h - boardSize) / 2;

  function reset() {
    const full = new Array<number>(N * N).fill(0);
    fillGrid(full);
    solution = full;
    puzzle = full.slice();
    given = new Array<boolean>(N * N).fill(true);
    // Blank out BLANKS distinct random cells.
    let blanked = 0;
    while (blanked < BLANKS) {
      const i = Math.floor(Math.random() * N * N);
      if (puzzle[i] !== 0) {
        puzzle[i] = 0;
        given[i] = false;
        blanked++;
      }
    }
    selected = -1;
    mistakesMade = 0;
    solved = false;
    updateHud();
  }

  /** Count current rule-violating filled cells. */
  function countConflicts(): number {
    let n = 0;
    for (let i = 0; i < N * N; i++) if (puzzle[i] !== 0 && isConflict(i)) n++;
    return n;
  }

  /** Does the filled digit at cell `i` clash with any peer? */
  function isConflict(i: number): boolean {
    const val = puzzle[i];
    if (val === 0) return false;
    const row = Math.floor(i / N);
    const col = i % N;
    for (let k = 0; k < N; k++) {
      const rIdx = row * N + k;
      const cIdx = k * N + col;
      if (rIdx !== i && puzzle[rIdx] === val) return true;
      if (cIdx !== i && puzzle[cIdx] === val) return true;
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const bIdx = (br + r) * N + (bc + c);
        if (bIdx !== i && puzzle[bIdx] === val) return true;
      }
    return false;
  }

  function updateHud() {
    let filled = 0;
    for (let i = 0; i < N * N; i++) if (puzzle[i] !== 0) filled++;
    hud.set("Filled", `${filled}/81`);
    hud.set("Mistakes", countConflicts());
  }

  /** Place (or clear with val=0) a digit into the selected cell. */
  function place(val: number) {
    if (solved || selected < 0 || given[selected]) return;
    puzzle[selected] = val;
    // Count a permanent mistake when a fresh wrong digit is committed.
    if (val !== 0 && val !== solution[selected]) mistakesMade++;
    sdk.haptic();
    updateHud();
    checkWin();
  }

  function checkWin() {
    for (let i = 0; i < N * N; i++) if (puzzle[i] !== solution[i]) return;
    solved = true;
    const score = Math.max(1, 500 - mistakesMade * 10);
    const isBest = sdk.submitScore("sudoku", score);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 25)), 1);
    sdk.addCoins(coins, "Sudoku Sadhana");
    sdk.sfx("clear");
    showOverlay(gc.canvas, {
      title: "Solved! 🧩",
      subtitle: "Nicely done",
      coins,
      isBest,
      primaryLabel: "New Puzzle",
      onPrimary: reset,
    });
  }

  // ── Input: pick a non-given cell ──
  gc.onDown((p) => {
    if (solved) return;
    const col = Math.floor((p.x - margin) / cell);
    const row = Math.floor((p.y - boardTop) / cell);
    if (col < 0 || col >= N || row < 0 || row >= N) return;
    const i = row * N + col;
    selected = given[i] ? -1 : i; // givens are not selectable
  });

  // ── Render loop ──
  gc.run(() => {
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    roundRect(ctx, margin, boardTop, boardSize, boardSize, 10, palette.cream);

    const selVal = selected >= 0 ? puzzle[selected] : 0;

    // Cell backgrounds: highlight selection and same-number cells.
    for (let i = 0; i < N * N; i++) {
      const row = Math.floor(i / N);
      const col = i % N;
      const x = margin + col * cell;
      const y = boardTop + row * cell;
      if (i === selected) {
        ctx.fillStyle = "rgba(76,201,240,0.45)"; // selected cell
        ctx.fillRect(x, y, cell, cell);
      } else if (selVal !== 0 && puzzle[i] === selVal) {
        ctx.fillStyle = "rgba(76,201,240,0.18)"; // matching numbers
        ctx.fillRect(x, y, cell, cell);
      }
    }

    // Grid lines — thin per cell, thick on 3×3 box boundaries.
    ctx.strokeStyle = "rgba(36,31,61,0.35)";
    for (let k = 0; k <= N; k++) {
      const thick = k % 3 === 0;
      ctx.lineWidth = thick ? 2.5 : 1;
      ctx.strokeStyle = thick ? palette.ink : "rgba(36,31,61,0.3)";
      const off = margin + k * cell;
      ctx.beginPath();
      ctx.moveTo(off, boardTop);
      ctx.lineTo(off, boardTop + boardSize);
      ctx.stroke();
      const offY = boardTop + k * cell;
      ctx.beginPath();
      ctx.moveTo(margin, offY);
      ctx.lineTo(margin + boardSize, offY);
      ctx.stroke();
    }

    // Digits.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < N * N; i++) {
      const val = puzzle[i];
      if (val === 0) continue;
      const row = Math.floor(i / N);
      const col = i % N;
      const cx = margin + col * cell + cell / 2;
      const cy = boardTop + row * cell + cell / 2;
      if (given[i]) {
        ctx.fillStyle = "rgba(36,31,61,0.55)"; // givens: bold-but-dim
        ctx.font = `bold ${Math.floor(cell * 0.58)}px sans-serif`;
      } else if (isConflict(i)) {
        ctx.fillStyle = palette.pink; // conflicting entry
        ctx.font = `${Math.floor(cell * 0.58)}px sans-serif`;
      } else {
        ctx.fillStyle = "#2b1a5e"; // valid player entry
        ctx.font = `${Math.floor(cell * 0.58)}px sans-serif`;
      }
      ctx.fillText(String(val), cx, cy);
    }
  });

  // ── Number pad + Erase (buttons in a .game-controls div) ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  for (let d = 1; d <= 9; d++) {
    const btn = document.createElement("button");
    btn.className = "btn-ghost";
    btn.textContent = String(d);
    btn.addEventListener("click", () => place(d));
    controls.appendChild(btn);
  }
  const erase = document.createElement("button");
  erase.className = "btn-ghost";
  erase.textContent = "⌫ Erase";
  erase.addEventListener("click", () => place(0));
  controls.appendChild(erase);
  host.appendChild(controls);

  reset();
  return () => gc.destroy();
}
