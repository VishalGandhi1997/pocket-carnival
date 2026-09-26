// Recall — memory pair matching. Flip two cards; match every pair in as few
// moves as possible. Fewer moves → more coins.
// Level ladder: the grid grows (L1 4×3 → L2 4×4 → L3 4×5 → L4+ 5×6) and from
// Level 3 the board is shown for a brief 1.5s peek before the cards hide.
// Match every pair within par to level up. Par allows ~2.2 moves per pair at
// Level 1 and tightens 0.05 per level down to 1.75, so the ladder keeps
// getting harder after the grid stops growing.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const FACES = [
  "🚀", "🍓", "🦊", "🎸", "🌵", "🐙", "⚽", "🍩", "🎈",
  "🦋", "🌙", "🍀", "🧩", "🐢", "🍉", "🎲", "🌈", "🍄",
];

const PEEK_SECONDS = 1.5;

/** Grid size for a level (columns × rows); capped at 5×6 from Level 4. */
function gridFor(level: number): { cols: number; rows: number } {
  if (level <= 1) return { cols: 4, rows: 3 };
  if (level === 2) return { cols: 4, rows: 4 };
  if (level === 3) return { cols: 4, rows: 5 };
  return { cols: 5, rows: 6 };
}
const hasPeek = (level: number) => level >= 3;
const parFor = (pairs: number, level: number) =>
  Math.ceil(pairs * Math.max(1.75, 2.2 - (level - 1) * 0.05));

interface Card {
  face: string;
  state: "down" | "up" | "gone";
  flipT: number;
}

export function mountYaadRakh(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Moves", "Par", "Pairs"]);
  const gc = createGameCanvas(host, 1.25);
  const { ctx } = gc;

  let level = sdk.getLevel("yaadrakh");
  let cols = 4;
  let rows = 3;
  let totalPairs = 6;
  let par = parFor(totalPairs, level);
  let cards: Card[] = [];
  let open: number[] = [];
  let moves = 0;
  let pairs = 0;
  let lock = 0; // seconds to keep mismatched cards visible
  let peek = 0; // seconds left of the opening "peek" (Level 3+)
  let done = false;

  function reset() {
    level = sdk.getLevel("yaadrakh");
    ({ cols, rows } = gridFor(level));
    totalPairs = (cols * rows) / 2;
    par = parFor(totalPairs, level);
    const picks = [...FACES].sort(() => Math.random() - 0.5).slice(0, totalPairs);
    const deck = [...picks, ...picks].sort(() => Math.random() - 0.5);
    cards = deck.map((face) => ({ face, state: "down" as const, flipT: 0 }));
    open = [];
    moves = 0;
    pairs = 0;
    lock = 0;
    peek = hasPeek(level) ? PEEK_SECONDS : 0;
    done = false;
    hud.set("Level", level);
    hud.set("Moves", 0);
    hud.set("Par", par);
    hud.set("Pairs", `0/${totalPairs}`);
  }

  function finish() {
    done = true;
    // score = 100 minus penalty for extra moves (perfect = one move per pair)
    const score = Math.max(10, 100 - (moves - totalPairs) * 5);
    const isBest = sdk.submitScore("yaadrakh", score);
    const leveledUp = moves <= par;
    const cleared = level;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("yaadrakh", level);
    }
    const coins = sdk.scaleReward(Math.max(2, Math.floor(score / 10)), level);
    sdk.addCoins(coins, "Recall");
    hud.set("Level", level);
    let subtitle: string;
    if (leveledUp) {
      const prev = gridFor(cleared);
      const next = gridFor(level);
      const bigger = next.cols * next.rows > prev.cols * prev.rows;
      const peekNew = hasPeek(level) && !hasPeek(cleared);
      subtitle = bigger
        ? `Level ${level} — bigger ${next.cols}×${next.rows} grid, ${(next.cols * next.rows) / 2} pairs${peekNew ? ", quick peek then hide" : ""}`
        : `Level ${level} — ${moves}/${par} moves, bigger coins`;
    } else {
      subtitle = `${moves} moves · ${moves - par} over par (${par}) · match within par for Level ${level + 1}`;
    }
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "All Matched! 🎉",
      subtitle,
      coins,
      isBest,
      mood: "win",
      primaryLabel: leveledUp ? `Play Level ${level} ›` : "Play Again",
      onPrimary: reset,
    });
  }

  gc.onDown((p) => {
    if (done || peek > 0 || lock > 0 || open.length === 2) return;
    const { cw, ch, ox, oy, gap } = layout();
    const rx = p.x - ox;
    const ry = p.y - oy;
    if (rx < 0 || ry < 0) return;
    const x = Math.floor(rx / (cw + gap));
    const y = Math.floor(ry / (ch + gap));
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    // ignore taps that land in the gap between cards
    if (rx - x * (cw + gap) > cw || ry - y * (ch + gap) > ch) return;
    const i = y * cols + x;
    const c = cards[i];
    if (c.state !== "down") return;
    c.state = "up";
    open.push(i);
    sdk.haptic();
    if (open.length === 2) {
      moves++;
      hud.set("Moves", moves);
      const [a, b] = open;
      if (cards[a].face === cards[b].face) {
        cards[a].state = "gone";
        cards[b].state = "gone";
        pairs++;
        hud.set("Pairs", `${pairs}/${totalPairs}`);
        open = [];
        sdk.haptic(30);
        if (pairs === totalPairs) setTimeout(finish, 350);
      } else {
        lock = 0.75;
      }
    }
  });

  const TOP = 32; // caption strip above the grid (level / peek countdown)

  /** Card size for the current grid — fits the canvas below the caption
   *  strip, cards kept from getting too tall on small grids, grid centred. */
  function layout() {
    const pad = 14;
    const gap = cols >= 5 ? 8 : 10;
    const availH = gc.h - TOP - pad;
    const cw = (gc.w - pad * 2 - gap * (cols - 1)) / cols;
    const ch = Math.min(cw * 1.3, (availH - gap * (rows - 1)) / rows);
    const ox = pad;
    const oy = TOP + (availH - (ch * rows + gap * (rows - 1))) / 2;
    return { cw, ch, ox, oy, gap };
  }

  gc.run((dt) => {
    if (peek > 0) peek = Math.max(0, peek - dt);
    if (lock > 0) {
      lock -= dt;
      if (lock <= 0) {
        for (const i of open) cards[i].state = "down";
        open = [];
      }
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const { cw, ch, ox, oy, gap } = layout();
    const r = cols >= 5 ? 9 : 12;
    const faceSize = Math.min(cw, ch) * 0.55;
    cards.forEach((c, i) => {
      const x = ox + (i % cols) * (cw + gap);
      const y = oy + Math.floor(i / cols) * (ch + gap);
      if (c.state === "gone") {
        roundRect(ctx, x, y, cw, ch, r, "rgba(6,214,160,0.15)");
        return;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (c.state === "down" && peek <= 0) {
        roundRect(ctx, x, y, cw, ch, r, palette.board);
        ctx.fillStyle = "rgba(255,248,236,0.25)";
        ctx.font = `800 ${Math.min(cw, ch) * 0.4}px "Baloo 2", sans-serif`;
        ctx.fillText("?", x + cw / 2, y + ch / 2 + 2);
      } else {
        roundRect(ctx, x, y, cw, ch, r, palette.cream);
        ctx.font = `${faceSize}px sans-serif`;
        ctx.fillText(c.face, x + cw / 2, y + ch / 2 + 2);
      }
    });
    // Caption strip: peek countdown, otherwise level + grid + par.
    ctx.fillStyle = peek > 0 ? "rgba(255,248,236,0.95)" : "rgba(255,248,236,0.7)";
    ctx.font = `800 16px "Baloo 2", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      peek > 0
        ? `👀 Memorize! ${peek.toFixed(1)}s`
        : `Level ${level} · ${cols}×${rows} · par ${par} moves`,
      gc.w / 2,
      TOP / 2 + 2,
    );
  });

  reset();
  return () => gc.destroy();
}
