// Tile Slider — the classic sliding-number puzzle. Tap a tile in the gap's
// row/column (or swipe) to slide tiles into the gap; put 1..N²−1 back in order.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

type Dir = "up" | "down" | "left" | "right";
const SLIDE_MS = 110;

// Level curve: 3×3 for L1-3, 4×4 for L4-7, 5×5 from L8; scramble deepens each level.
const sizeFor = (level: number) => (level <= 3 ? 3 : level <= 7 ? 4 : 5);
const scrambleFor = (level: number) => Math.min(400, 20 + level * 15);

interface Anim {
  fx: number; // from column
  fy: number; // from row
  t: number; // start time (ms)
}

export function mountSlider(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Moves", "Time"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  let level = sdk.getLevel("slider");
  let n = sizeFor(level);
  let board: number[] = []; // board[r*n+c] = tile number, 0 = gap
  let gap = 0;
  let moves = 0;
  let elapsed = 0;
  let started = false;
  let solved = false;
  const anims = new Map<number, Anim>();

  const fmtTime = (s: number) => {
    const t = Math.floor(s);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };

  const isSolved = () => board.every((v, i) => (i === n * n - 1 ? v === 0 : v === i + 1));

  function neighbours(idx: number): number[] {
    const r = Math.floor(idx / n);
    const c = idx % n;
    const out: number[] = [];
    if (r > 0) out.push(idx - n);
    if (r < n - 1) out.push(idx + n);
    if (c > 0) out.push(idx - 1);
    if (c < n - 1) out.push(idx + 1);
    return out;
  }

  /** Start solved, then walk the gap S random legal steps (no immediate undo). */
  function newBoard() {
    level = sdk.getLevel("slider");
    n = sizeFor(level);
    const steps = scrambleFor(level);
    do {
      board = Array.from({ length: n * n }, (_, i) => (i === n * n - 1 ? 0 : i + 1));
      gap = n * n - 1;
      let prev = -1;
      for (let s = 0; s < steps; s++) {
        const opts = neighbours(gap).filter((i) => i !== prev);
        const pick = opts[Math.floor(Math.random() * opts.length)];
        board[gap] = board[pick];
        board[pick] = 0;
        prev = gap;
        gap = pick;
      }
    } while (isSolved());
    moves = 0;
    elapsed = 0;
    started = false;
    solved = false;
    anims.clear();
    hud.set("Level", level);
    hud.set("Moves", 0);
    hud.set("Time", fmtTime(0));
  }

  /** Slide every tile between `idx` and the gap one step toward the gap. */
  function slideFrom(idx: number) {
    if (solved || idx === gap || idx < 0 || idx >= n * n) return;
    const r = Math.floor(idx / n);
    const c = idx % n;
    const gr = Math.floor(gap / n);
    const gcol = gap % n;
    if (r !== gr && c !== gcol) return;
    const step = r === gr ? Math.sign(c - gcol) : Math.sign(r - gr) * n;
    const now = performance.now();
    let cur = gap;
    while (cur !== idx) {
      const src = cur + step;
      const tile = board[src];
      board[cur] = tile;
      anims.set(tile, { fx: src % n, fy: Math.floor(src / n), t: now });
      cur = src;
      moves++;
    }
    board[idx] = 0;
    gap = idx;
    started = true;
    sdk.haptic();
    hud.set("Moves", moves);
    if (isSolved()) win();
  }

  function win() {
    solved = true;
    const seconds = Math.floor(elapsed);
    const prevN = n;
    level += 1;
    sdk.setLevel("slider", level);
    const harder = sizeFor(level) > prevN ? "bigger board" : "deeper shuffle";
    const score = Math.max(10, 500 - moves - seconds);
    const isBest = sdk.submitScore("slider", score);
    const coins = sdk.scaleReward(5 + prevN, level);
    sdk.addCoins(coins, "Tile Slider");
    hud.set("Level", level);
    // let the final slide finish before the overlay covers the board
    window.setTimeout(() => {
      showOverlay(gc.canvas, {
        title: "⬆️ Level Up!",
        subtitle: `Level ${level} — ${harder} · ${moves} moves in ${fmtTime(seconds)}`,
        coins,
        isBest,
        mood: "win",
        primaryLabel: "Next Puzzle",
        onPrimary: newBoard,
      });
    }, SLIDE_MS + 60);
  }

  // Geometry shared by input + drawing.
  const pad = 12;
  const tileGap = 6;
  const cellSize = () => (gc.w - pad * 2 - tileGap * (n - 1)) / n;

  gc.onDown((p) => {
    const cs = cellSize();
    const c = Math.floor((p.x - pad) / (cs + tileGap));
    const r = Math.floor((p.y - pad) / (cs + tileGap));
    if (c < 0 || c >= n || r < 0 || r >= n) return;
    slideFrom(r * n + c);
  });

  // Swipe moves the tile next to the gap in the swipe direction (into the gap).
  gc.onSwipe((d: Dir) => {
    const gr = Math.floor(gap / n);
    const gcol = gap % n;
    if (d === "left" && gcol < n - 1) slideFrom(gap + 1);
    else if (d === "right" && gcol > 0) slideFrom(gap - 1);
    else if (d === "up" && gr < n - 1) slideFrom(gap + n);
    else if (d === "down" && gr > 0) slideFrom(gap - n);
  });

  // Free re-roll of the current level's board.
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const shuffleBtn = document.createElement("button");
  shuffleBtn.className = "btn-ghost";
  shuffleBtn.textContent = "🔀 Shuffle again";
  shuffleBtn.addEventListener("click", () => {
    if (!solved) newBoard();
  });
  controls.appendChild(shuffleBtn);
  host.appendChild(controls);

  gc.run((dt) => {
    if (started && !solved) {
      elapsed += dt;
      hud.set("Time", fmtTime(elapsed));
    }
    const now = performance.now();
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const cs = cellSize();
    const rad = cs * 0.16;
    // empty wells
    for (let i = 0; i < n * n; i++)
      roundRect(ctx, pad + (i % n) * (cs + tileGap), pad + Math.floor(i / n) * (cs + tileGap), cs, cs, rad, palette.board);

    for (let i = 0; i < n * n; i++) {
      const v = board[i];
      if (!v) continue;
      let col = i % n;
      let row = Math.floor(i / n);
      const a = anims.get(v);
      if (a) {
        const k = Math.min(1, (now - a.t) / SLIDE_MS);
        const e = 1 - (1 - k) * (1 - k); // ease-out
        col = a.fx + (col - a.fx) * e;
        row = a.fy + (row - a.fy) * e;
        if (k >= 1) anims.delete(v);
      }
      const x = pad + col * (cs + tileGap);
      const y = pad + row * (cs + tileGap);
      const targetRow = Math.floor((v - 1) / n);
      const color = palette.pieces[targetRow % palette.pieces.length];
      const home = v === i + 1 && !a;

      ctx.save();
      if (home) {
        ctx.shadowColor = palette.cream;
        ctx.shadowBlur = 14;
      }
      roundRect(ctx, x, y + 3, cs, cs, rad, "rgba(0,0,0,0.28)");
      roundRect(ctx, x, y, cs, cs, rad, color);
      ctx.restore();
      // glossy top sheen
      const g = ctx.createLinearGradient(0, y, 0, y + cs);
      g.addColorStop(0, "rgba(255,255,255,0.42)");
      g.addColorStop(0.5, "rgba(255,255,255,0.08)");
      g.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.beginPath();
      ctx.roundRect(x, y, cs, cs, rad);
      ctx.fillStyle = g;
      ctx.fill();
      if (home) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,248,236,0.85)";
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, cs - 2, cs - 2, rad);
        ctx.stroke();
      }
      ctx.fillStyle = palette.ink;
      ctx.font = `800 ${Math.round(cs * 0.42)}px "Baloo 2", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(v), x + cs / 2, y + cs / 2 + 2);
    }
  });

  newBoard();
  return () => gc.destroy();
}
