// Pipeline — rotate-the-pipes puzzle. Tap a tile to turn it 90° clockwise;
// water floods from the source tank on the left through every connected
// opening. Link the source to the drain on the right to clear the level.
// Every board is carved from a guaranteed source→drain path, then scrambled.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

// Openings as a 4-bit mask: N=1, E=2, S=4, W=8.
interface Dir {
  bit: number;
  dx: number;
  dy: number;
  opp: number;
}
const DIRS: Dir[] = [
  { bit: 1, dx: 0, dy: -1, opp: 4 },
  { bit: 2, dx: 1, dy: 0, opp: 8 },
  { bit: 4, dx: 0, dy: 1, opp: 1 },
  { bit: 8, dx: -1, dy: 0, opp: 2 },
];
// Filler shapes (weighted): end-cap, straight, elbow ×2, tee, cross.
const FILLERS = [1, 5, 3, 3, 7, 15];

const rotCW = (m: number): number => ((m << 1) | (m >> 3)) & 15;
const rotN = (m: number, k: number): number => {
  for (let i = 0; i < k; i++) m = rotCW(m);
  return m;
};
const rand = (n: number): number => Math.floor(Math.random() * n);
const gridSize = (level: number): number => Math.min(9, 4 + Math.floor((level - 1) / 2));

interface Tile {
  mask: number;
  spin: number; // remaining rotation animation (1 = one quarter-turn behind)
}

export function mountPipeline(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Moves"]);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  let level = 1;
  let n = 4;
  let sr = 0; // source row (enters cell (0, sr) from the west)
  let dr = 0; // drain row (leaves cell (n-1, dr) to the east)
  let tiles: Tile[] = [];
  let moves = 0;
  let limit = 0;
  let over = false;
  let time = 0;
  let timer = 0;

  const margin = gc.w * 0.09;
  const G = gc.w - margin * 2; // board side
  const cs = () => G / n;

  // Random DFS from the source cell to the drain cell. Visited cells are never
  // unmarked, so it always terminates and the returned path is simple.
  function carve(eastBias: boolean): [number, number][] {
    const seen = new Uint8Array(n * n);
    const path: [number, number][] = [];
    const dfs = (x: number, y: number): boolean => {
      seen[y * n + x] = 1;
      path.push([x, y]);
      if (x === n - 1 && y === dr) return true;
      const order = DIRS.slice().sort(() => Math.random() - 0.5);
      if (eastBias) order.sort((a, b) => b.dx - a.dx); // heads east → short, easy path
      for (const d of order) {
        const nx = x + d.dx, ny = y + d.dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || seen[ny * n + nx]) continue;
        if (dfs(nx, ny)) return true;
      }
      path.pop();
      return false;
    };
    dfs(0, sr);
    return path;
  }

  // Longer paths with more bends make harder boards.
  function twistiness(path: [number, number][]): number {
    let turns = 0;
    for (let i = 2; i < path.length; i++) {
      const [ax, ay] = path[i - 2], [cx, cy] = path[i];
      if (ax !== cx && ay !== cy) turns++;
    }
    return path.length + turns * 2;
  }

  function dirBit(fx: number, fy: number, tx: number, ty: number): number {
    return DIRS.find((d) => d.dx === tx - fx && d.dy === ty - fy)!.bit;
  }

  function flood(): { wet: Uint8Array; solved: boolean } {
    const wet = new Uint8Array(n * n);
    const stack: number[] = [];
    if (tiles[sr * n].mask & 8) {
      wet[sr * n] = 1;
      stack.push(sr * n);
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % n, y = Math.floor(i / n);
      for (const d of DIRS) {
        if (!(tiles[i].mask & d.bit)) continue;
        const nx = x + d.dx, ny = y + d.dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (wet[j] || !(tiles[j].mask & d.opp)) continue;
        wet[j] = 1;
        stack.push(j);
      }
    }
    const end = dr * n + n - 1;
    return { wet, solved: wet[end] === 1 && (tiles[end].mask & 2) !== 0 };
  }

  function build() {
    clearTimeout(timer);
    level = sdk.getLevel("pipeline");
    n = gridSize(level);
    sr = rand(n);
    dr = rand(n);
    let path = carve(level < 3);
    if (level >= 3) {
      // From level 3 the route is forced longer: keep the twistiest of several carves.
      for (let i = 0; i < Math.min(12, level); i++) {
        const p = carve(false);
        if (twistiness(p) > twistiness(path)) path = p;
      }
    }
    const want: number[] = new Array<number>(n * n).fill(-1);
    path.forEach(([x, y], i) => {
      const inBit = i === 0 ? 8 : dirBit(x, y, path[i - 1][0], path[i - 1][1]);
      const outBit = i === path.length - 1 ? 2 : dirBit(x, y, path[i + 1][0], path[i + 1][1]);
      want[y * n + x] = inBit | outBit;
    });
    // Scramble every tile; par = quarter-turns needed to restore the carved path.
    let par = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      tiles = [];
      par = 0;
      for (let i = 0; i < n * n; i++) {
        const base = want[i] >= 0 ? want[i] : FILLERS[rand(FILLERS.length)];
        const mask = rotN(base, rand(4));
        tiles.push({ mask, spin: 0 });
        if (want[i] >= 0) {
          let t = 0;
          while (rotN(mask, t) !== want[i]) t++;
          par += t;
        }
      }
      if (par >= Math.max(2, Math.floor(path.length / 3)) && !flood().solved) break;
    }
    moves = 0;
    limit = par * 2;
    over = false;
    hud.set("Level", level);
    hud.set("Moves", `0/${limit}`);
  }

  function win() {
    const cleared = level;
    const oldN = n;
    level += 1;
    sdk.setLevel("pipeline", level);
    sdk.sfx("clear");
    const isBest = sdk.submitScore("pipeline", cleared);
    const coins = sdk.scaleReward(6, cleared);
    sdk.addCoins(coins, "Pipeline");
    showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Level ${level} — ${gridSize(level) > oldN ? "bigger grid" : "twistier pipes"}`,
      coins,
      isBest,
      mood: "win",
      primaryLabel: "Next Level",
      onPrimary: build,
    });
  }

  function fail() {
    sdk.haptic(60);
    sdk.submitScore("pipeline", level - 1);
    showOverlay(gc.canvas, {
      title: "Out of Moves",
      subtitle: `Level ${level} · connect the drain within ${limit} turns`,
      mood: "lose",
      primaryLabel: "Try Again",
      onPrimary: build,
    });
  }

  gc.onDown((p) => {
    if (over) return;
    const s = cs();
    const gx = Math.floor((p.x - margin) / s);
    const gy = Math.floor((p.y - margin) / s);
    if (gx < 0 || gy < 0 || gx >= n || gy >= n) return;
    const t = tiles[gy * n + gx];
    t.mask = rotCW(t.mask);
    t.spin = Math.min(2, t.spin + 1);
    moves++;
    sdk.haptic();
    hud.set("Moves", `${moves}/${limit}`);
    if (flood().solved) {
      over = true;
      timer = window.setTimeout(win, 450); // let the water reach the drain first
    } else if (moves >= limit) {
      over = true;
      timer = window.setTimeout(fail, 300);
    }
  });

  const water = (k: number) => `hsl(${186 + 8 * Math.sin(time * 4 + k)}, 85%, 58%)`;
  const DRY = "#8a84a8";

  // Draw one pipe centred on the origin: flush butt ends at the tile edges so
  // neighbouring pipes line up, with a round joint in the middle.
  function drawPipe(mask: number, s: number, color: string, wet: boolean) {
    const r = s / 2;
    const layer = (w: number, c: string) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.lineCap = "butt";
      ctx.beginPath();
      for (const d of DIRS) {
        if (!(mask & d.bit)) continue;
        ctx.moveTo(0, 0);
        ctx.lineTo(d.dx * r, d.dy * r);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    };
    layer(s * 0.36, "rgba(10,6,30,0.45)");
    layer(s * 0.26, color);
    layer(s * 0.08, wet ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)");
    if (mask === 1 || mask === 2 || mask === 4 || mask === 8) {
      // End-cap: a valve knob sealing the pipe.
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = s * 0.05;
      ctx.strokeStyle = "rgba(10,6,30,0.5)";
      ctx.stroke();
    }
  }

  function drawTank(x: number, y: number, lit: boolean, edgeX: number) {
    const s = cs();
    ctx.lineCap = "butt";
    ctx.lineWidth = s * 0.26;
    ctx.strokeStyle = lit ? water(0) : DRY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(edgeX, y);
    ctx.stroke();
    const tw = margin * 0.78, th = Math.max(tw * 1.4, s * 0.8);
    ctx.save();
    if (lit) {
      ctx.shadowColor = palette.sky;
      ctx.shadowBlur = 14 + 6 * Math.sin(time * 3);
    }
    roundRect(ctx, x - tw / 2, y - th / 2, tw, th, tw * 0.35, lit ? palette.sky : "#5b5380");
    ctx.restore();
    // Glass highlight + water line.
    roundRect(ctx, x - tw / 2 + 3, y - th / 2 + 3, tw * 0.28, th - 6, tw * 0.14, "rgba(255,255,255,0.25)");
    if (lit) roundRect(ctx, x - tw / 2 + 2, y - th * 0.1 + Math.sin(time * 3) * 1.5, tw - 4, 2, 1, "rgba(255,255,255,0.6)");
  }

  gc.run((dt) => {
    time += dt;
    for (const t of tiles) t.spin = Math.max(0, t.spin - dt / 0.12);
    const { wet, solved } = flood();
    const s = cs();

    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    roundRect(ctx, margin - 6, margin - 6, G + 12, G + 12, 14, palette.ink);
    drawTank(margin * 0.5, margin + (sr + 0.5) * s, true, margin);
    drawTank(gc.w - margin * 0.5, margin + (dr + 0.5) * s, solved, margin + G);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const t = tiles[i];
        const tx = margin + x * s, ty = margin + y * s;
        roundRect(ctx, tx + 2, ty + 2, s - 4, s - 4, s * 0.18, palette.board);
        roundRect(ctx, tx + 2, ty + 2, s - 4, (s - 4) * 0.45, s * 0.18, "rgba(255,248,236,0.06)");
        // Ease-out: the tile starts a quarter-turn back and settles into place.
        const f = t.spin > 1 ? t.spin : t.spin * t.spin;
        ctx.save();
        ctx.translate(tx + s / 2, ty + s / 2);
        ctx.rotate((-f * Math.PI) / 2);
        drawPipe(t.mask, s, wet[i] ? water(x + y) : DRY, wet[i] === 1);
        ctx.restore();
      }
    }
  });

  build();
  return () => {
    clearTimeout(timer);
    gc.destroy();
  };
}
