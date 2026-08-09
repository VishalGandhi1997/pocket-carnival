// Tila Match — mahjong-solitaire style triple matcher. Tap FREE tiles
// (nothing overlapping them on a higher layer) to move them into a 7-slot
// tray; three of a kind pop for +30. Clear the board to win — if the tray
// fills with no triple, it's game over. 🔀 Shuffle is the free escape hatch.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

// Emoji pool — 8 faces are drawn per round, 6 copies each: 48 tiles =
// 16 triples, so every face count is a multiple of 3 and the board is
// always fully consumable.
const FACES = ["🛺", "☕", "🏏", "🪁", "🌶️", "🥭", "🐘", "🎡", "💎", "🌸"];
const TYPES = 8; // distinct faces per round
const COPIES = 6; // copies per face — a multiple of 3
const TRAY_MAX = 7; // tray slots; 7 tiles with no triple = lose

// Three stacked layers (cols × rows, offsets in tile units). Upper layers
// sit at half-tile offsets so each pins the tiles beneath. Layer 3 is 3×2
// (not 2×2) so the total is 30 + 12 + 6 = 48 = TYPES × COPIES — the count
// must stay divisible by 3 or the board could never fully clear.
const LAYERS = [
  { cols: 6, rows: 5, ox: 0, oy: 0 },
  { cols: 4, rows: 3, ox: 1.5, oy: 1 },
  { cols: 3, rows: 2, ox: 1.5, oy: 1.5 },
];
const LIFT = 7; // cosmetic y-rise per layer for stacked depth

interface Tile {
  face: string;
  x: number; // logical board-space rect (depth lift excluded)
  y: number;
  layer: number;
  alive: boolean;
}

interface TrayEntry {
  face: string;
  born: number; // clock time it landed — drives the pop-in animation
}

export function mountTilaMatch(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Tiles", "Best"]);
  const gc = createGameCanvas(host, 1.35);
  const { ctx } = gc;

  // ── Precomputed geometry ──
  const T = Math.floor(gc.w / 8); // tile edge, ~w/8
  const bx = Math.round((gc.w - 6 * T) / 2); // board origin
  const by = 50;
  const GAP = 6; // gap between tray slots
  const S = Math.floor((gc.w - 36 - GAP * (TRAY_MAX - 1)) / TRAY_MAX); // slot edge
  const trayX = Math.round((gc.w - (TRAY_MAX * S + GAP * (TRAY_MAX - 1))) / 2);
  const trayY = gc.h - S - 22;

  let tiles: Tile[] = [];
  let tray: TrayEntry[] = [];
  let score = 0;
  let over = false;
  let time = 0; // run-loop clock (seconds)

  function shuffleArr<A>(a: A[]): A[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function syncHud() {
    hud.set("Tiles", tiles.filter((t) => t.alive).length);
    hud.set("Best", sdk.getBest("tilamatch"));
  }

  /** Deal a fresh 48-tile board across the three layers. */
  function reset() {
    const deck = shuffleArr(
      shuffleArr([...FACES])
        .slice(0, TYPES)
        .flatMap((f) => Array(COPIES).fill(f) as string[]),
    );
    tiles = [];
    LAYERS.forEach((L, layer) => {
      for (let r = 0; r < L.rows; r++)
        for (let c = 0; c < L.cols; c++)
          tiles.push({
            face: deck[tiles.length],
            x: bx + (L.ox + c) * T,
            y: by + (L.oy + r) * T,
            layer,
            alive: true,
          });
    });
    tray = [];
    score = 0;
    over = false;
    syncHud();
  }

  /** Free ⇔ no alive tile on a HIGHER layer overlaps this tile's rect.
   *  A few px of tolerance stops exactly-adjacent edges from blocking. */
  function isFree(t: Tile): boolean {
    const P = 4;
    return !tiles.some(
      (u) =>
        u.alive &&
        u.layer > t.layer &&
        u.x + P < t.x + T &&
        t.x + P < u.x + T &&
        u.y + P < t.y + T &&
        t.y + P < u.y + T,
    );
  }

  function win() {
    over = true;
    score += 100; // board-clear bonus
    const isBest = sdk.submitScore("tilamatch", score);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 25)), 1);
    sdk.addCoins(coins, "Tila Match");
    syncHud();
    showOverlay(gc.canvas, {
      title: "Board Clear! 🀄",
      coins,
      isBest,
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function lose() {
    over = true;
    sdk.addCoins(2, "Tila Match"); // consolation coins
    showOverlay(gc.canvas, {
      title: "Tray Full! 😵",
      coins: 2,
      mood: "lose",
      primaryLabel: "Try Again",
      onPrimary: reset,
    });
  }

  /** Move a free tile into the tray, grouping it beside same-face tiles;
   *  a completed triple pops immediately. */
  function pickUp(t: Tile) {
    t.alive = false;
    sdk.haptic();
    let at = tray.length; // default: append at the end
    for (let i = tray.length - 1; i >= 0; i--)
      if (tray[i].face === t.face) {
        at = i + 1;
        break;
      }
    tray.splice(at, 0, { face: t.face, born: time });
    if (tray.filter((e) => e.face === t.face).length >= 3) {
      tray = tray.filter((e) => e.face !== t.face); // pop the triple
      score += 30;
      sdk.sfx("clear");
      sdk.haptic(30);
    }
    syncHud();
    if (tiles.every((u) => !u.alive) && tray.length === 0) win();
    else if (tray.length >= TRAY_MAX) lose();
  }

  // Tap: topmost alive tile under the finger wins; only free tiles react.
  gc.onDown((p) => {
    if (over) return;
    let hit: Tile | null = null;
    for (const t of tiles) {
      if (!t.alive) continue;
      const dy = t.y - t.layer * LIFT; // drawn (lifted) position
      if (p.x >= t.x && p.x <= t.x + T && p.y >= dy && p.y <= dy + T)
        if (!hit || t.layer > hit.layer) hit = t;
    }
    if (hit && isFree(hit)) pickUp(hit);
  });

  // ── Drawing ──
  function drawTile(x: number, y: number, size: number, face: string, free: boolean) {
    roundRect(ctx, x + 2, y + 5, size - 4, size - 3, size * 0.18, "rgba(0,0,0,0.35)"); // side
    roundRect(ctx, x + 2, y + 2, size - 4, size - 4, size * 0.18, free ? palette.cream : "#8f86b8");
    ctx.globalAlpha = free ? 1 : 0.45; // covered tiles read as dimmed
    ctx.font = `${Math.round(size * 0.55)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(face, x + size / 2, y + size / 2 + 1);
    ctx.globalAlpha = 1;
  }

  gc.run((dt) => {
    time += dt;
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    // board mat (tall enough to include the lifted upper layers)
    roundRect(ctx, bx - 10, by - 10 - 2 * LIFT, 6 * T + 20, 5 * T + 20 + 2 * LIFT, 14, palette.board);
    // tiles, bottom layer first so higher layers paint on top
    for (const t of tiles) if (t.alive) drawTile(t.x, t.y - t.layer * LIFT, T, t.face, isFree(t));
    // tray — slots glow pink when one tap from disaster
    const danger = tray.length >= TRAY_MAX - 1 && !over;
    for (let i = 0; i < TRAY_MAX; i++) {
      const sx = trayX + i * (S + GAP);
      roundRect(ctx, sx, trayY, S, S, 10, danger ? "rgba(239,71,111,0.4)" : "rgba(255,248,236,0.14)");
      const e = tray[i] as TrayEntry | undefined;
      if (e) {
        const k = Math.min(1, (time - e.born) / 0.15); // pop-in scale
        const sz = S * (0.7 + 0.3 * k);
        const off = (S - sz) / 2;
        drawTile(sx + off, trayY + off, sz, e.face, true);
      }
    }
  });

  // ── Controls: free reshuffle of the remaining board faces ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const shuf = document.createElement("button");
  shuf.className = "btn-ghost";
  shuf.textContent = "🔀 Shuffle";
  shuf.addEventListener("click", () => {
    if (over) return;
    const live = tiles.filter((t) => t.alive);
    const faces = shuffleArr(live.map((t) => t.face));
    live.forEach((t, i) => (t.face = faces[i]));
    sdk.sfx("tick");
  });
  controls.append(shuf);
  host.appendChild(controls);

  reset();
  return () => gc.destroy();
}
