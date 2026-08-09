// Jodi Merge — merge-2 board puzzle. Drag matching emoji onto each other to
// grow the chain (🌱→🌿→🌼→🌸→💐), then drag finished items onto order
// cards at the top to deliver. 8 deliveries ends the round.
import { createGameCanvas, palette, roundRect, type Pointer } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import { floatText } from "../../engine/fx";
import type { Sdk } from "../../sdk/platform";

const COLS = 5;
const ROWS = 6;
const ITEMS = ["🌱", "🌿", "🌼", "🌸", "💐"]; // tier 0-4
const MAX_TIER = ITEMS.length - 1;
const ORDERS_TO_WIN = 8;

/** Random order tier 2-4, weighted toward 2-3 (bouquets stay rare). */
function newOrderTier(): number {
  const r = Math.random();
  return r < 0.42 ? 2 : r < 0.82 ? 3 : 4;
}

export function mountJodiMerge(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Orders", "Score"]);
  const gc = createGameCanvas(host, 1.35);
  const { ctx, w, h } = gc;

  // ── Layout ──
  const pad = 10;
  const ordersY = 8;
  const cardGap = 8;
  const cardW = (w - pad * 2 - cardGap * 2) / 3;
  const cardH = Math.round(h * 0.115);
  const gridY = ordersY + cardH + 12;
  const cell = Math.min((w - pad * 2) / COLS, (h - gridY - pad) / ROWS);
  const gridX = (w - cell * COLS) / 2;

  // ── State ──
  let grid: (number | null)[] = [];
  let orders: number[] = [];
  let flashes = [0, 0, 0]; // per-card blink after a delivery
  let delivered = 0;
  let score = 0;
  let over = false;
  let drag: { from: number; tier: number; x: number; y: number } | null = null;

  function reset() {
    grid = Array<number | null>(COLS * ROWS).fill(null);
    // ~8 starter seedlings/sprouts on random distinct cells
    const idx = grid.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (const i of idx.slice(0, 8)) grid[i] = Math.random() < 0.6 ? 0 : 1;
    orders = [newOrderTier(), newOrderTier(), newOrderTier()];
    flashes = [0, 0, 0];
    delivered = 0;
    score = 0;
    over = false;
    drag = null;
    hud.set("Orders", `${delivered}/${ORDERS_TO_WIN}`);
    hud.set("Score", 0);
  }

  // ── Hit tests ──
  function cellAt(p: Pointer): number {
    const gx = Math.floor((p.x - gridX) / cell);
    const gy = Math.floor((p.y - gridY) / cell);
    return gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS ? gy * COLS + gx : -1;
  }

  function orderAt(p: Pointer): number {
    for (let i = 0; i < 3; i++) {
      const x = pad + i * (cardW + cardGap);
      if (p.x >= x && p.x <= x + cardW && p.y >= ordersY && p.y <= ordersY + cardH) return i;
    }
    return -1;
  }

  const cellCX = (i: number) => gridX + ((i % COLS) + 0.5) * cell;
  const cellCY = (i: number) => gridY + (Math.floor(i / COLS) + 0.5) * cell;

  // ── Actions ──
  function deliver(orderIdx: number, d: NonNullable<typeof drag>) {
    grid[d.from] = null; // item consumed
    delivered++;
    score += 50;
    orders[orderIdx] = newOrderTier();
    flashes[orderIdx] = 0.45;
    sdk.sfx("coin");
    sdk.haptic(30);
    floatText(gc.canvas.parentElement!, pad + orderIdx * (cardW + cardGap) + cardW / 2, ordersY + cardH / 2, "+50");
    hud.set("Orders", `${delivered}/${ORDERS_TO_WIN}`);
    hud.set("Score", score);
    if (delivered >= ORDERS_TO_WIN) finish();
  }

  function merge(target: number, d: NonNullable<typeof drag>) {
    grid[d.from] = null;
    grid[target] = d.tier + 1;
    score += 15 * (d.tier + 1);
    sdk.sfx("clear");
    sdk.haptic(30);
    floatText(gc.canvas.parentElement!, cellCX(target), cellCY(target), `+${15 * (d.tier + 1)}`);
    hud.set("Score", score);
  }

  function finish() {
    over = true;
    const isBest = sdk.submitScore("jodimerge", score);
    const coins = sdk.scaleReward(Math.max(2, Math.floor(score / 20)), 1);
    sdk.addCoins(coins, "Jodi Merge");
    showOverlay(gc.canvas, {
      title: "Orders Done! 🎁",
      subtitle: `Score ${score}`,
      coins,
      isBest,
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  // ── Input ──
  gc.onDown((p) => {
    if (over) return;
    const i = cellAt(p);
    if (i >= 0 && grid[i] !== null) {
      drag = { from: i, tier: grid[i]!, x: p.x, y: p.y };
      sdk.haptic();
    }
  });
  gc.onMove((p) => {
    if (drag) {
      drag.x = p.x;
      drag.y = p.y;
    }
  });
  gc.onUp((p) => {
    if (!drag || over) {
      drag = null;
      return;
    }
    const d = drag;
    drag = null; // any non-handled path below = item snaps home
    const oi = orderAt(p);
    if (oi >= 0 && orders[oi] === d.tier) return deliver(oi, d);
    const ci = cellAt(p);
    if (ci < 0 || ci === d.from) return;
    if (grid[ci] === null) {
      grid[ci] = d.tier; // move to empty cell
      grid[d.from] = null;
      sdk.haptic();
    } else if (grid[ci] === d.tier && d.tier < MAX_TIER) {
      merge(ci, d);
    }
  });

  // ── Crate button (.game-controls) ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const crate = document.createElement("button");
  crate.className = "btn-ghost";
  crate.textContent = "📦 Crate";
  crate.addEventListener("click", () => {
    if (over) return;
    const empty = grid.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
    if (!empty.length) return; // board full → nothing
    grid[empty[Math.floor(Math.random() * empty.length)]] = 0;
    sdk.sfx("pop");
  });
  controls.appendChild(crate);
  host.appendChild(controls);

  // ── Render ──
  function drawEmoji(e: string, x: number, y: number, size: number) {
    ctx.font = `${Math.round(size)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e, x, y + size * 0.05);
  }

  gc.run((dt) => {
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);
    // order cards
    for (let i = 0; i < 3; i++) {
      const x = pad + i * (cardW + cardGap);
      const match = drag !== null && orders[i] === drag.tier;
      roundRect(ctx, x, ordersY, cardW, cardH, 10, match ? palette.teal : palette.board);
      if (flashes[i] > 0) {
        flashes[i] -= dt;
        ctx.globalAlpha = Math.max(0, flashes[i] / 0.45);
        roundRect(ctx, x, ordersY, cardW, cardH, 10, palette.cream);
        ctx.globalAlpha = 1;
      }
      drawEmoji("🎁", x + 12, ordersY + 12, 13);
      drawEmoji(ITEMS[orders[i]], x + cardW / 2, ordersY + cardH / 2 + 2, cardH * 0.52);
    }
    // grid + items (dragged item hidden from its home cell)
    const hover = drag ? cellAt(drag) : -1;
    for (let i = 0; i < COLS * ROWS; i++) {
      roundRect(ctx, gridX + (i % COLS) * cell + 1.5, gridY + Math.floor(i / COLS) * cell + 1.5, cell - 3, cell - 3, 8, palette.board);
      if (drag && i === hover && i !== drag.from) {
        const ok = grid[i] === null || (grid[i] === drag.tier && drag.tier < MAX_TIER);
        ctx.globalAlpha = 0.35;
        roundRect(ctx, gridX + (i % COLS) * cell + 1.5, gridY + Math.floor(i / COLS) * cell + 1.5, cell - 3, cell - 3, 8, ok ? palette.teal : palette.pink);
        ctx.globalAlpha = 1;
      }
      const t = grid[i];
      if (t !== null && !(drag && drag.from === i)) drawEmoji(ITEMS[t], cellCX(i), cellCY(i), cell * 0.7);
    }
    // dragged item floats above the finger
    if (drag) drawEmoji(ITEMS[drag.tier], drag.x, drag.y - cell * 0.5, cell * 0.8);
  });

  reset();
  return () => gc.destroy();
}
