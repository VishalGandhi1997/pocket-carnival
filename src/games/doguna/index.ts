// Double Up — swipe-to-merge doubling puzzle on a 4×4 grid.
// Level ladder: each level sets a goal tile (128 at Level 1, doubling per
// level, capped at 4096) and spawns more 4s (10% → 40%, capped). Building the
// goal tile ends the run with a Level Up.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const N = 4;
const TILE_COLORS: Record<number, string> = {
  2: "#4cc9f0", 4: "#06d6a0", 8: "#83e377", 16: "#ffd166", 32: "#ff9f1c",
  64: "#f7717d", 128: "#ef476f", 256: "#c77dff", 512: "#9b5de5",
  1024: "#f15bb5", 2048: "#fee440", 4096: "#00bbf9",
};

// Goal tile for a level: 128, 256, 512, … capped at 4096.
const targetTile = (level: number) => Math.min(4096, 128 * 2 ** (level - 1));
// Chance a freshly spawned tile is a 4 (fewer free merges at higher levels).
const fourChance = (level: number) => Math.min(0.4, 0.1 + (level - 1) * 0.04);

export function mountDoGuna(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Goal", "Score", "Best"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  let grid: number[][] = [];
  let score = 0;
  let over = false;
  let level = sdk.getLevel("doguna");
  let goal = targetTile(level);

  function reset() {
    level = sdk.getLevel("doguna");
    goal = targetTile(level);
    grid = Array.from({ length: N }, () => Array(N).fill(0));
    score = 0;
    over = false;
    spawn();
    spawn();
    hud.set("Level", level);
    hud.set("Goal", goal);
    hud.set("Score", 0);
    hud.set("Best", sdk.getBest("doguna"));
  }

  function spawn() {
    const empty: number[][] = [];
    grid.forEach((row, y) => row.forEach((v, x) => !v && empty.push([x, y])));
    if (!empty.length) return;
    const [x, y] = empty[Math.floor(Math.random() * empty.length)];
    grid[y][x] = Math.random() < fourChance(level) ? 4 : 2;
  }

  /** Slide+merge one row leftward. Returns [newRow, gained, moved]. */
  function slide(row: number[]): [number[], number, boolean] {
    const vals = row.filter(Boolean);
    const out: number[] = [];
    let gained = 0;
    for (let i = 0; i < vals.length; i++) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        out.push(vals[i] * 2);
        gained += vals[i] * 2;
        i++;
      } else out.push(vals[i]);
    }
    while (out.length < N) out.push(0);
    return [out, gained, out.some((v, i) => v !== row[i])];
  }

  function move(dir: "up" | "down" | "left" | "right") {
    if (over) return;
    let moved = false;
    const get = (i: number, j: number) =>
      dir === "left" ? grid[i][j] : dir === "right" ? grid[i][N - 1 - j]
      : dir === "up" ? grid[j][i] : grid[N - 1 - j][i];
    const set = (i: number, j: number, v: number) => {
      if (dir === "left") grid[i][j] = v;
      else if (dir === "right") grid[i][N - 1 - j] = v;
      else if (dir === "up") grid[j][i] = v;
      else grid[N - 1 - j][i] = v;
    };
    for (let i = 0; i < N; i++) {
      const row = Array.from({ length: N }, (_, j) => get(i, j));
      const [merged, gained, didMove] = slide(row);
      if (didMove) moved = true;
      score += gained;
      merged.forEach((v, j) => set(i, j, v));
    }
    if (!moved) return;
    spawn();
    hud.set("Score", score);
    sdk.haptic();
    // Hitting the goal tile wins the level (checked before "stuck").
    if (maxTile() >= goal) {
      over = true;
      sdk.haptic(40);
      setTimeout(() => endGame(true), 350); // let the goal tile show first
    } else if (isStuck()) endGame(false);
  }

  function maxTile(): number {
    return Math.max(...grid.map((row) => Math.max(...row)));
  }

  function isStuck(): boolean {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (!grid[y][x]) return false;
        if (x + 1 < N && grid[y][x] === grid[y][x + 1]) return false;
        if (y + 1 < N && grid[y][x] === grid[y + 1][x]) return false;
      }
    return true;
  }

  function endGame(leveledUp: boolean) {
    over = true;
    const isBest = sdk.submitScore("doguna", score);
    const top = maxTile();
    if (leveledUp) {
      level += 1;
      sdk.setLevel("doguna", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 50)), level);
    sdk.addCoins(coins, "Double Up");
    hud.set("Best", sdk.getBest("doguna"));
    hud.set("Level", level);
    const nextGoal = targetTile(level);
    hud.set("Goal", nextGoal);
    const pct4 = Math.round(fourChance(level) * 100);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "No Moves Left!",
      subtitle: leveledUp
        ? `Level ${level} — goal tile ${nextGoal}, ${pct4}% of new tiles are 4s`
        : `Score ${score} · best tile ${top} · build ${nextGoal} to reach Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: leveledUp ? `Play Level ${level} ›` : "Play Again",
      onPrimary: reset,
    });
  }

  gc.onSwipe(move);

  gc.run(() => {
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const pad = 12;
    const gap = 8;
    const cell = (gc.w - pad * 2 - gap * (N - 1)) / N;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const px = pad + x * (cell + gap);
        const py = pad + y * (cell + gap);
        const v = grid[y][x];
        roundRect(ctx, px, py, cell, cell, 12, v ? TILE_COLORS[v] ?? "#fee440" : palette.board);
        if (v) {
          ctx.fillStyle = v <= 4 ? palette.ink : "#fff";
          ctx.font = `800 ${v < 128 ? 34 : v < 1024 ? 28 : 22}px "Baloo 2", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(v), px + cell / 2, py + cell / 2 + 2);
        }
      }
  });

  reset();
  return () => gc.destroy();
}
