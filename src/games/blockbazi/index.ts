// BlockBazi — grid-fit block puzzle. 9×9 board; clear rows, columns AND
// 3×3 zones (our sudoku-grid twist on the world's #1 casual format).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay, showRevive, makeBoosterBar } from "../../engine/ui";
import { toast } from "../../sdk/platform";
import { reviveCost, ECONOMY } from "../../sdk/economy";
import { floatText } from "../../engine/fx";
import type { Sdk } from "../../sdk/platform";

const N = 9;

// Piece shapes as cell offsets. Original bag — generic geometry only.
const SHAPES: number[][][] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 1], [1, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
];

interface Piece {
  cells: number[][];
  color: string;
  w: number;
  h: number;
}

// Difficulty tiers over the shape bag. Higher levels see harder pieces more
// often (the awkward 5-cell L, long 4-lines, the 3×3 block), so the board
// jams faster and each level genuinely raises the challenge.
const EASY = [0, 1, 2, 8, 9, 10, 11]; // singles, dominoes, small L-corners
const MED = [3, 4, 5, 13]; // trominoes, 2×2, T
const HARD = [6, 7, 12, 14, 15]; // 4-lines, 5-cell L, diagonal, 3×3

function pickShapeIndex(level: number): number {
  const d = Math.min(1, (level - 1) / 7); // 0 at Lv1 → 1 at Lv8+
  const hardChance = 0.04 + d * 0.34; // 4% → 38%
  const medChance = 0.34 + d * 0.06;
  const r = Math.random();
  const pool = r < hardChance ? HARD : r < hardChance + medChance ? MED : EASY;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomPiece(level: number): Piece {
  const cells = SHAPES[pickShapeIndex(level)];
  return {
    cells,
    color: palette.pieces[Math.floor(Math.random() * 6)],
    w: Math.max(...cells.map((c) => c[0])) + 1,
    h: Math.max(...cells.map((c) => c[1])) + 1,
  };
}

// Score in one run needed to advance from `level` to the next.
const levelUpAt = (level: number) => 60 + level * 45;

export function mountBlockBazi(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Score", "Best"]);
  const gc = createGameCanvas(host, 1.42);
  const { ctx, w } = gc;

  let level = sdk.getLevel("blockbazi");

  const pad = 10;
  const cell = (w - pad * 2) / N;
  const boardTop = 8;
  const trayY = boardTop + N * cell + 26;
  const traySlot = w / 3;

  let board: (string | null)[][] = [];
  let tray: (Piece | null)[] = [];
  let score = 0;
  let over = false;
  let drag: { idx: number; p: Piece; x: number; y: number } | null = null;
  let flash: { cells: number[][]; t: number } | null = null;
  let reviveCount = 0;
  let usedAdRevive = false;
  let hammerArmed = false;

  function refill(): Piece[] {
    return [randomPiece(level), randomPiece(level), randomPiece(level)];
  }

  function reset() {
    level = sdk.getLevel("blockbazi");
    board = Array.from({ length: N }, () => Array(N).fill(null));
    tray = refill();
    score = 0;
    over = false;
    reviveCount = 0;
    usedAdRevive = false;
    hud.set("Level", level);
    hud.set("Score", 0);
    hud.set("Best", sdk.getBest("blockbazi"));
  }

  function fits(p: Piece, gx: number, gy: number): boolean {
    return p.cells.every(([cx, cy]) => {
      const x = gx + cx, y = gy + cy;
      return x >= 0 && x < N && y >= 0 && y < N && !board[y][x];
    });
  }

  function anyFit(p: Piece): boolean {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (fits(p, x, y)) return true;
    return false;
  }

  function place(p: Piece, gx: number, gy: number) {
    for (const [cx, cy] of p.cells) board[gy + cy][gx + cx] = p.color;
    score += p.cells.length;
    clearLines();
    if (tray.every((t) => !t)) tray = refill();
    hud.set("Score", score);
    sdk.haptic();
    if (!tray.some((t) => t && anyFit(t))) gameOver();
  }

  function clearLines() {
    const clear: number[][] = [];
    for (let y = 0; y < N; y++)
      if (board[y].every(Boolean)) for (let x = 0; x < N; x++) clear.push([x, y]);
    for (let x = 0; x < N; x++)
      if (board.every((row) => row[x])) for (let y = 0; y < N; y++) clear.push([x, y]);
    // 3×3 bonus zones — the BlockBazi twist
    for (let by = 0; by < 3; by++)
      for (let bx = 0; bx < 3; bx++) {
        let full = true;
        for (let y = by * 3; y < by * 3 + 3; y++)
          for (let x = bx * 3; x < bx * 3 + 3; x++) if (!board[y][x]) full = false;
        if (full)
          for (let y = by * 3; y < by * 3 + 3; y++)
            for (let x = bx * 3; x < bx * 3 + 3; x++) clear.push([x, y]);
      }
    if (!clear.length) return;
    const unique = Array.from(new Set(clear.map(([x, y]) => y * N + x)));
    score += unique.length * 2;
    flash = { cells: unique.map((i) => [i % N, Math.floor(i / N)]), t: 0.28 };
    for (const i of unique) board[Math.floor(i / N)][i % N] = null;
    sdk.haptic(30);
    sdk.sfx("clear");
    // floating "+N" at the centroid of the cleared cells
    const cx = flash.cells.reduce((s, [x]) => s + x, 0) / flash.cells.length;
    const cy = flash.cells.reduce((s, [, y]) => s + y, 0) / flash.cells.length;
    floatText(
      gc.canvas.parentElement!,
      pad + (cx + 0.5) * cell,
      boardTop + (cy + 0.5) * cell,
      `+${unique.length * 2}`,
    );
  }

  // Revive clears the bottom 3 rows to make room, keeps score + fresh pieces.
  function doRevive() {
    for (let y = N - 3; y < N; y++) for (let x = 0; x < N; x++) board[y][x] = null;
    tray = refill();
    over = false;
  }

  function gameOver() {
    over = true;
    sdk.haptic(30);
    const cost = reviveCost(reviveCount);
    showRevive(gc.canvas, {
      coinCost: cost,
      adAvailable: !usedAdRevive,
      onReviveCoins: () => {
        if (sdk.spendCoins(cost)) {
          reviveCount++;
          doRevive();
        } else finishGame();
      },
      onReviveAd: async () => {
        const ok = await sdk.watchAd();
        if (ok) {
          usedAdRevive = true;
          doRevive();
        }
        return ok;
      },
      onDecline: finishGame,
    });
  }

  function finishGame() {
    over = true;
    const isBest = sdk.submitScore("blockbazi", score);
    // Beat this level's target in one run → level up (harder + better payout).
    const leveledUp = score >= levelUpAt(level);
    if (leveledUp) {
      level += 1;
      sdk.setLevel("blockbazi", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 10)), level);
    sdk.addCoins(coins, "BlockBazi");
    hud.set("Best", sdk.getBest("blockbazi"));
    hud.set("Level", level);
    const need = levelUpAt(level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Board Jammed!",
      subtitle: leveledUp
        ? `Now Level ${level} — tougher pieces, bigger coins`
        : `Score ${score} · ${need - score} more to reach Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  // ── Input ──
  gc.onDown((pt) => {
    if (over) return;
    // Hammer booster: next tap on a filled cell smashes it.
    if (hammerArmed) {
      const gx = Math.floor((pt.x - pad) / cell);
      const gy = Math.floor((pt.y - boardTop) / cell);
      if (gx >= 0 && gx < N && gy >= 0 && gy < N && board[gy][gx]) {
        board[gy][gx] = null;
        hammerArmed = false;
        sdk.haptic(30);
        sdk.sfx("pop");
      }
      return;
    }
    if (pt.y > trayY - 10) {
      const idx = Math.min(2, Math.floor(pt.x / traySlot));
      const p = tray[idx];
      if (p) drag = { idx, p, x: pt.x, y: pt.y };
    }
  });
  gc.onMove((pt) => {
    if (drag) {
      drag.x = pt.x;
      drag.y = pt.y;
    }
  });
  gc.onUp(() => {
    if (!drag) return;
    const { gx, gy } = dragGrid(drag);
    if (fits(drag.p, gx, gy)) {
      tray[drag.idx] = null;
      place(drag.p, gx, gy);
    }
    drag = null;
  });

  /** Grid cell for the dragged piece (lifted above the finger). */
  function dragGrid(d: NonNullable<typeof drag>) {
    const px = d.x - (d.p.w * cell) / 2;
    const py = d.y - d.p.h * cell - 24;
    return {
      gx: Math.round((px - pad) / cell),
      gy: Math.round((py - boardTop) / cell),
    };
  }

  // ── Render ──
  function drawCell(x: number, y: number, color: string, alpha = 1) {
    ctx.globalAlpha = alpha;
    roundRect(ctx, pad + x * cell + 1.5, boardTop + y * cell + 1.5, cell - 3, cell - 3, 5, color);
    ctx.globalAlpha = 1;
  }

  // Booster bar — spend coins for in-run help (the difficulty-spike payoff).
  makeBoosterBar(host, [
    {
      icon: "🔨", label: "Hammer", cost: ECONOMY.boosters.hammer,
      onUse: () => {
        hammerArmed = true;
        toast("🔨 Tap any block to smash it");
      },
    },
    {
      icon: "🔄", label: "New Pieces", cost: ECONOMY.boosters.newPieces,
      onUse: () => {
        tray = refill();
        if (over) {
          over = false;
          document.querySelector(".overlay.revive")?.remove();
        }
      },
    },
  ]);

  gc.run((dt) => {
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const theme = sdk.skinColors("blockbazi");
    // board base + 3×3 zone tint (from the equipped board theme)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const zone = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
        drawCell(x, y, zone ? theme.zoneA ?? "#4e3c9c" : theme.zoneB ?? palette.board);
      }
    // placed blocks
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (board[y][x]) drawCell(x, y, board[y][x]!);
    // clear flash
    if (flash) {
      flash.t -= dt;
      for (const [x, y] of flash.cells) drawCell(x, y, palette.cream, Math.max(0, flash.t / 0.28));
      if (flash.t <= 0) flash = null;
    }
    // ghost preview
    if (drag) {
      const { gx, gy } = dragGrid(drag);
      const ok = fits(drag.p, gx, gy);
      for (const [cx, cy] of drag.p.cells) {
        const x = gx + cx, y = gy + cy;
        if (x >= 0 && x < N && y >= 0 && y < N)
          drawCell(x, y, ok ? palette.teal : palette.pink, 0.4);
      }
    }
    // tray
    for (let i = 0; i < 3; i++) {
      const p = tray[i];
      if (!p || (drag && drag.idx === i)) continue;
      const s = cell * 0.55;
      const ox = i * traySlot + traySlot / 2 - (p.w * s) / 2;
      const oy = trayY + 40 - (p.h * s) / 2;
      for (const [cx, cy] of p.cells)
        roundRect(ctx, ox + cx * s + 1, oy + cy * s + 1, s - 2, s - 2, 4, p.color);
    }
    // dragged piece at full size
    if (drag) {
      const px = drag.x - (drag.p.w * cell) / 2;
      const py = drag.y - drag.p.h * cell - 24;
      for (const [cx, cy] of drag.p.cells)
        roundRect(ctx, px + cx * cell + 1.5, py + cy * cell + 1.5, cell - 3, cell - 3, 5, drag.p.color);
    }
  });

  reset();
  return () => gc.destroy();
}
