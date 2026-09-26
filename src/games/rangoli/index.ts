// Pixel Logic — a nonogram/picross. Row and column clues give the
// run-lengths of consecutive filled pixels; deduce and fill every pixel to
// reveal a mirror-symmetric pixel-art picture. Three wrong taps end the round.
// Each solved picture levels up to a bigger grid (6×6 → 10×10).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const MAX_MISTAKES = 3;
// ── Level curve ── L1 = 6×6, +1 every two levels, capped at 10×10.
const gridFor = (level: number) => Math.min(10, 6 + Math.floor(level / 2));
const MIN_FILL = 0.375; // regenerate pictures sparser than this share

export function mountRangoli(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Done", "Mistakes"]);
  const gc = createGameCanvas(host, 1.2);
  const { ctx } = gc;

  // Layout: left strip for row clues, top strip for column clues (~22% each).
  const pad = 8;
  const clueW = gc.w * 0.22;
  const clueH = gc.h * 0.22;
  // Grid size + geometry follow the level, recomputed each round.
  let level = sdk.getLevel("rangoli");
  let N = gridFor(level);
  let cell = 0;
  let gx0 = 0;
  let gy0 = 0;
  function layout() {
    cell = Math.min((gc.w - clueW - pad) / N, (gc.h - clueH - pad) / N);
    gx0 = clueW + (gc.w - clueW - pad - cell * N) / 2;
    gy0 = clueH + (gc.h - clueH - pad - cell * N) / 2;
  }
  layout();

  const makeGrid = (): boolean[][] =>
    Array.from({ length: N }, () => new Array<boolean>(N).fill(false));

  let solution: boolean[][] = makeGrid();
  let filled: boolean[][] = makeGrid(); // correctly placed pixels (permanent)
  let marked: boolean[][] = makeGrid(); // ✕ notes (player marks + auto-marked misses)
  let rowClues: number[][] = [];
  let colClues: number[][] = [];
  let totalPixels = 0;
  let doneCount = 0;
  let mistakes = 0;
  let markMode = false;
  let over = false;
  let won = false;
  let flashes: { x: number; y: number; t: number }[] = []; // red mistake flashes
  let revealTimer = 0;

  // Random solution mirrored left-right so the picture reads like pixel art
  // (odd sizes get a free centre column).
  function genSolution(): boolean[][] {
    const s = makeGrid();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < Math.ceil(N / 2); x++) {
        const on = Math.random() < 0.5;
        s[y][x] = on;
        s[y][N - 1 - x] = on;
      }
    }
    return s;
  }

  function countPixels(s: boolean[][]): number {
    let n = 0;
    for (const row of s) for (const c of row) if (c) n++;
    return n;
  }

  // Run-lengths of consecutive filled cells, e.g. ■■■·■ → [3,1]; empty → [0].
  function runsOf(line: boolean[]): number[] {
    const runs: number[] = [];
    let run = 0;
    for (const c of line) {
      if (c) run++;
      else if (run) {
        runs.push(run);
        run = 0;
      }
    }
    if (run) runs.push(run);
    return runs.length ? runs : [0];
  }

  const rowDone = (y: number): boolean => solution[y].every((s, x) => !s || filled[y][x]);
  const colDone = (x: number): boolean => solution.every((row, y) => !row[x] || filled[y][x]);

  function reset() {
    window.clearTimeout(revealTimer);
    level = sdk.getLevel("rangoli");
    N = gridFor(level);
    layout();
    const minPixels = Math.ceil(N * N * MIN_FILL);
    do {
      solution = genSolution();
      totalPixels = countPixels(solution);
    } while (totalPixels < minPixels);
    filled = makeGrid();
    marked = makeGrid();
    rowClues = solution.map(runsOf);
    colClues = [];
    for (let x = 0; x < N; x++) colClues.push(runsOf(solution.map((row) => row[x])));
    doneCount = 0;
    mistakes = 0;
    over = false;
    won = false;
    flashes = [];
    hud.set("Level", level);
    hud.set("Done", `0/${totalPixels}`);
    hud.set("Mistakes", `0/${MAX_MISTAKES}`);
  }

  function lose() {
    over = true;
    sdk.submitScore("rangoli", 0);
    const coins = sdk.scaleReward(2, level);
    sdk.addCoins(coins, "Pixel Logic");
    showOverlay(gc.canvas, {
      title: "Out of Lives! 💔",
      subtitle: `${doneCount}/${totalPixels} pixels · finish a picture to reach Level ${level + 1}`,
      coins,
      mood: "lose",
      primaryLabel: "New Puzzle",
      onPrimary: reset,
    });
  }

  function win() {
    over = true;
    won = true; // switches the board to the coloured picture reveal
    const score = 200 + (N - 6) * 30 - mistakes * 40;
    const isBest = sdk.submitScore("rangoli", score);
    level += 1;
    sdk.setLevel("rangoli", level);
    hud.set("Level", level);
    const coins = sdk.scaleReward(Math.max(3, Math.floor(score / 20)), level);
    sdk.addCoins(coins, "Pixel Logic");
    sdk.sfx("clear");
    const next = gridFor(level);
    // Let the reveal breathe for a beat before the results overlay.
    revealTimer = window.setTimeout(() => {
      showOverlay(gc.canvas, {
        title: "⬆️ Level Up!",
        subtitle: `${mistakes} mistakes · Level ${level} — ${next}×${next} grid${next > N ? " (bigger picture)" : ""}`,
        coins,
        isBest,
        primaryLabel: "New Puzzle",
        onPrimary: reset,
      });
    }, 700);
  }

  gc.onDown((p) => {
    if (over) return;
    const x = Math.floor((p.x - gx0) / cell);
    const y = Math.floor((p.y - gy0) / cell);
    if (x < 0 || x >= N || y < 0 || y >= N) return;
    if (filled[y][x]) return; // placed pixels are permanent

    if (markMode) {
      // Free notes: toggle a grey ✕, never penalised.
      marked[y][x] = !marked[y][x];
      sdk.haptic();
      return;
    }
    if (marked[y][x]) return; // marks protect against accidental fills

    if (solution[y][x]) {
      filled[y][x] = true;
      doneCount++;
      hud.set("Done", `${doneCount}/${totalPixels}`);
      sdk.haptic();
      sdk.sfx("pop");
      if (doneCount === totalPixels) win();
    } else {
      marked[y][x] = true; // auto-mark the miss so it can't be repeated
      mistakes++;
      hud.set("Mistakes", `${mistakes}/${MAX_MISTAKES}`);
      flashes.push({ x, y, t: 0.5 });
      sdk.haptic(40);
      if (mistakes >= MAX_MISTAKES) lose();
    }
  });

  gc.run((dt) => {
    flashes = flashes.filter((f) => (f.t -= dt) > 0);
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    ctx.textBaseline = "middle";
    const clueFont = Math.max(10, cell * 0.34);
    ctx.font = `bold ${clueFont}px system-ui`;

    // Column clues — stacked above each column, bottom-anchored at the grid.
    ctx.textAlign = "center";
    for (let x = 0; x < N; x++) {
      ctx.fillStyle = colDone(x) ? "rgba(255,248,236,0.25)" : palette.cream;
      const runs = colClues[x];
      for (let i = 0; i < runs.length; i++) {
        const cy = gy0 - 10 - (runs.length - 1 - i) * (clueFont + 4);
        ctx.fillText(String(runs[i]), gx0 + x * cell + cell / 2, cy);
      }
    }
    // Row clues — right-aligned against the grid's left edge.
    ctx.textAlign = "right";
    for (let y = 0; y < N; y++) {
      ctx.fillStyle = rowDone(y) ? "rgba(255,248,236,0.25)" : palette.cream;
      ctx.fillText(rowClues[y].join(" "), gx0 - 8, gy0 + y * cell + cell / 2);
    }
    ctx.textAlign = "center";

    // Cells.
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const cx = gx0 + x * cell;
        const cy = gy0 + y * cell;
        const inset = 1.5;
        if (filled[y][x]) {
          // On win, alternate pixel colours in a checker for the picture reveal.
          const colour = won ? ((x + y) % 2 ? palette.pink : palette.marigold) : palette.pink;
          roundRect(ctx, cx + inset, cy + inset, cell - inset * 2, cell - inset * 2, won ? cell * 0.35 : 5, colour);
        } else {
          roundRect(ctx, cx + inset, cy + inset, cell - inset * 2, cell - inset * 2, 5, palette.board);
          if (marked[y][x] && !won) {
            ctx.font = `bold ${cell * 0.5}px system-ui`;
            ctx.fillStyle = "rgba(255,248,236,0.45)";
            ctx.fillText("✕", cx + cell / 2, cy + cell / 2 + 1);
            ctx.font = `bold ${clueFont}px system-ui`;
          }
        }
      }
    }

    // Midline guides make run-counting easier (classic picross aid); odd
    // grids have no clean midline, so they skip it.
    if (!won && N % 2 === 0) {
      const mid = N / 2;
      ctx.strokeStyle = "rgba(255,248,236,0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx0 + mid * cell, gy0);
      ctx.lineTo(gx0 + mid * cell, gy0 + N * cell);
      ctx.moveTo(gx0, gy0 + mid * cell);
      ctx.lineTo(gx0 + N * cell, gy0 + mid * cell);
      ctx.stroke();
    }

    // Fading red flash on mistaken taps.
    for (const f of flashes) {
      const a = Math.min(0.85, f.t * 1.7);
      roundRect(ctx, gx0 + f.x * cell + 1.5, gy0 + f.y * cell + 1.5, cell - 3, cell - 3, 5, `rgba(239,71,111,${a})`);
    }
  });

  // ── Controls ── Fill/Mark mode toggle, styled active while marking.
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const modeBtn = document.createElement("button");
  modeBtn.className = "btn-ghost";
  modeBtn.textContent = "🖌️ Fill";
  modeBtn.addEventListener("click", () => {
    markMode = !markMode;
    modeBtn.textContent = markMode ? "✖️ Mark" : "🖌️ Fill";
    modeBtn.classList.toggle("active", markMode);
  });
  controls.appendChild(modeBtn);
  host.appendChild(controls);

  reset();
  return () => {
    window.clearTimeout(revealTimer);
    gc.destroy();
  };
}
