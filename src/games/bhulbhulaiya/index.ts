// Bhul Bhulaiya — procedural maze escape. Swipe to ICE-SLIDE: you glide
// cell-by-cell until a wall stops you, so every maze is a routing puzzle,
// not a stroll. Reach the glowing door 🚪; grab 🪙 tucked into dead ends.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

type Dir = "up" | "down" | "left" | "right";
interface Cell { top: boolean; right: boolean; bottom: boolean; left: boolean }

const DIRS: Dir[] = ["up", "down", "left", "right"];
const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const WALL: Record<Dir, keyof Cell> = { up: "top", down: "bottom", left: "left", right: "right" };
const SLIDE_SPEED = 12; // cells per second
const COIN_COUNT = 3;

/**
 * Perfect maze via recursive backtracking (iterative, explicit stack — no
 * recursion-depth worries even at 15×15).
 *
 *  1. Every cell starts with all four walls up; (0,0) is visited + pushed.
 *  2. Peek the stack top and gather its UNVISITED neighbours.
 *  3. If any exist: pick one at random, knock down the shared wall on BOTH
 *     sides (this cell's side and the neighbour's opposite side), mark the
 *     neighbour visited and push it — the walk burrows deeper.
 *  4. If none: pop (backtrack) until a cell with unvisited neighbours appears.
 *  5. Stack empty ⇒ all cells visited exactly once ⇒ corridors form a
 *     spanning tree: exactly ONE route between any two cells, no loops,
 *     no unreachable pockets — a "perfect" maze.
 */
function generateMaze(n: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ top: true, right: true, bottom: true, left: true })),
  );
  const visited = new Set<number>();
  const id = (x: number, y: number) => y * n + x;
  const stack: [number, number][] = [[0, 0]];
  visited.add(0);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options: [Dir, number, number][] = [];
    for (const d of DIRS) {
      const nx = x + DELTA[d][0];
      const ny = y + DELTA[d][1];
      if (nx >= 0 && ny >= 0 && nx < n && ny < n && !visited.has(id(nx, ny))) options.push([d, nx, ny]);
    }
    if (!options.length) {
      stack.pop(); // dead end — backtrack
      continue;
    }
    const [d, nx, ny] = options[Math.floor(Math.random() * options.length)];
    grid[y][x][WALL[d]] = false; // knock down our side…
    grid[ny][nx][WALL[OPPOSITE[d]]] = false; // …and the neighbour's side
    visited.add(id(nx, ny));
    stack.push([nx, ny]);
  }
  return grid;
}

export function mountBhulBhulaiya(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Moves", "Coins"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  let level = sdk.getLevel("bhulbhulaiya");
  let N = 7;
  let maze: Cell[][] = [];
  let coins: { x: number; y: number; taken: boolean }[] = [];
  let cellX = 0; // logical cell — jumps to the slide's destination instantly
  let cellY = 0;
  const pos = { x: 0, y: 0 }; // animated position (cell units) chasing cellX/Y
  let sliding = false;
  let pending: Dir | null = null; // at most ONE queued swipe (newest wins)
  let moves = 0;
  let collected = 0;
  let won = false;
  let trail: { x: number; y: number; life: number }[] = [];
  let glow = 0;

  function reset() {
    level = sdk.getLevel("bhulbhulaiya");
    N = Math.min(6 + level, 15);
    maze = generateMaze(N);
    // Hide the coins in dead ends (3-walled cells) — never the start or exit.
    const ends: [number, number][] = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const c = maze[y][x];
        const wallCount = (c.top ? 1 : 0) + (c.right ? 1 : 0) + (c.bottom ? 1 : 0) + (c.left ? 1 : 0);
        if (wallCount === 3 && !(x === 0 && y === 0) && !(x === N - 1 && y === N - 1)) ends.push([x, y]);
      }
    for (let i = ends.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ends[i], ends[j]] = [ends[j], ends[i]];
    }
    coins = ends.slice(0, COIN_COUNT).map(([x, y]) => ({ x, y, taken: false }));
    cellX = 0; cellY = 0; pos.x = 0; pos.y = 0;
    sliding = false; pending = null; moves = 0; collected = 0; won = false; trail = [];
    hud.set("Level", level);
    hud.set("Moves", `0/${N}`); // par = N — an escape in ≤N slides is sharp
    hud.set("Coins", `0/${coins.length}`);
  }

  function startSlide(d: Dir) {
    // Ice-slide: march from the current cell until a wall blocks direction d.
    let x = cellX, y = cellY;
    const [dx, dy] = DELTA[d];
    while (!maze[y][x][WALL[d]]) { x += dx; y += dy; }
    if (x === cellX && y === cellY) return sdk.haptic(); // flush against a wall
    cellX = x; cellY = y;
    sliding = true;
    moves++;
    hud.set("Moves", `${moves}/${N}`);
  }

  function win() {
    won = true;
    const score = 100 + collected * 15 + Math.max(0, N * 3 - moves) * 2;
    level += 1; // level up on EVERY escape — the next maze grows
    sdk.setLevel("bhulbhulaiya", level);
    const isBest = sdk.submitScore("bhulbhulaiya", score);
    const reward = sdk.scaleReward(5 + Math.floor(score / 25), level);
    sdk.addCoins(reward, "Bhul Bhulaiya");
    showOverlay(gc.canvas, {
      title: "Nikal Gaye! 🌀",
      subtitle: `Level ${level - 1} escaped — next maze is bigger`,
      coins: reward,
      isBest,
      mood: "win",
      primaryLabel: `Level ${level} ›`,
      onPrimary: reset,
    });
  }

  gc.onSwipe((d) => {
    if (won) return;
    if (sliding) pending = d; // queue exactly one; latest swipe replaces it
    else startSlide(d);
  });

  gc.run((dt) => {
    glow += dt * 4;
    // ── slide animation ──
    if (sliding && !won) {
      trail.push({ x: pos.x, y: pos.y, life: 0.3 });
      const step = SLIDE_SPEED * dt;
      const dx = cellX - pos.x, dy = cellY - pos.y;
      if (Math.abs(dx) + Math.abs(dy) <= step) {
        pos.x = cellX; pos.y = cellY;
        sliding = false;
        sdk.haptic(); // thunk — the wall that stopped us
        if (cellX === N - 1 && cellY === N - 1) win();
        else if (pending) { const d = pending; pending = null; startSlide(d); }
      } else {
        pos.x += Math.sign(dx) * step;
        pos.y += Math.sign(dy) * step;
      }
      const cx = Math.round(pos.x), cy = Math.round(pos.y);
      const c = coins.find((k) => !k.taken && k.x === cx && k.y === cy);
      if (c) {
        c.taken = true;
        collected++;
        sdk.sfx("coin");
        hud.set("Coins", `${collected}/${coins.length}`);
      }
    }
    for (const t of trail) t.life -= dt;
    trail = trail.filter((t) => t.life > 0);

    // ── draw ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const pad = 14;
    const cell = (gc.w - pad * 2) / N;
    const mid = (v: number) => pad + v * cell + cell / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // exit — pulsing gold cell with a glowing door
    ctx.save();
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 14 + Math.sin(glow) * 6;
    roundRect(ctx, pad + (N - 1) * cell + 2, pad + (N - 1) * cell + 2, cell - 4, cell - 4, 6, "rgba(255,209,102,0.30)");
    ctx.restore();
    ctx.font = `${cell * 0.6}px sans-serif`;
    ctx.fillText("🚪", mid(N - 1), mid(N - 1) + cell * 0.03);
    // coins — bobbing gently in their dead ends
    ctx.font = `${cell * 0.44}px sans-serif`;
    for (const k of coins)
      if (!k.taken) ctx.fillText("🪙", mid(k.x), mid(k.y) + Math.sin(glow + k.x + k.y) * cell * 0.05);
    // maze walls — 2px cream. Each cell draws its top+left; the last row and
    // column add the outer bottom/right so shared walls aren't double-drawn.
    ctx.strokeStyle = palette.cream;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const c = maze[y][x];
        const x0 = pad + x * cell, y0 = pad + y * cell;
        if (c.top) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + cell, y0); }
        if (c.left) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + cell); }
        if (y === N - 1 && c.bottom) { ctx.moveTo(x0, y0 + cell); ctx.lineTo(x0 + cell, y0 + cell); }
        if (x === N - 1 && c.right) { ctx.moveTo(x0 + cell, y0); ctx.lineTo(x0 + cell, y0 + cell); }
      }
    ctx.stroke();
    // fading trail behind the slide
    for (const t of trail) {
      ctx.globalAlpha = (t.life / 0.3) * 0.5;
      ctx.beginPath();
      ctx.arc(mid(t.x), mid(t.y), cell * 0.16, 0, 7);
      ctx.fillStyle = palette.marigold;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // player — glowing marigold dot with a specular glint
    ctx.save();
    ctx.shadowColor = palette.marigold;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(mid(pos.x), mid(pos.y), cell * 0.3, 0, 7);
    ctx.fillStyle = palette.marigold;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(mid(pos.x) - cell * 0.09, mid(pos.y) - cell * 0.09, cell * 0.08, 0, 7);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
    if (moves === 0 && !won) {
      ctx.fillStyle = "rgba(255,248,236,0.75)";
      ctx.font = "11px sans-serif";
      ctx.fillText("Swipe — you slide until a wall stops you!", gc.w / 2, gc.h - 7);
    }
  });

  reset();
  return () => gc.destroy();
}
