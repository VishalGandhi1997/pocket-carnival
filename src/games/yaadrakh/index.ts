// Yaad Rakh — memory pair matching. Flip two cards; match all 8 pairs
// in as few moves as possible. Fewer moves → more coins.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const FACES = ["🪁", "🥭", "🐘", "🛺", "☕", "🎡", "🥁", "🌶️", "🦚", "🍬", "🏏", "🎨"];
const COLS = 4;
const ROWS = 4;

interface Card {
  face: string;
  state: "down" | "up" | "gone";
  flipT: number;
}

export function mountYaadRakh(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Moves", "Pairs"]);
  const gc = createGameCanvas(host, 1.25);
  const { ctx } = gc;

  let cards: Card[] = [];
  let open: number[] = [];
  let moves = 0;
  let pairs = 0;
  let lock = 0; // seconds to keep mismatched cards visible
  let done = false;

  function reset() {
    const picks = [...FACES].sort(() => Math.random() - 0.5).slice(0, (COLS * ROWS) / 2);
    const deck = [...picks, ...picks].sort(() => Math.random() - 0.5);
    cards = deck.map((face) => ({ face, state: "down" as const, flipT: 0 }));
    open = [];
    moves = 0;
    pairs = 0;
    lock = 0;
    done = false;
    hud.set("Moves", 0);
    hud.set("Pairs", `0/${(COLS * ROWS) / 2}`);
  }

  function finish() {
    done = true;
    // score = 100 minus penalty for extra moves (perfect = 8 moves)
    const score = Math.max(10, 100 - (moves - (COLS * ROWS) / 2) * 5);
    const isBest = sdk.submitScore("yaadrakh", score);
    const coins = Math.max(2, Math.floor(score / 10));
    sdk.addCoins(coins, "Yaad Rakh");
    showOverlay(gc.canvas, {
      title: "All Matched! 🎉",
      subtitle: `${moves} moves · score ${score}`,
      coins,
      isBest,
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.onDown((p) => {
    if (done || lock > 0 || open.length === 2) return;
    const { cw, ch, pad, gap } = layout();
    const x = Math.floor((p.x - pad) / (cw + gap));
    const y = Math.floor((p.y - pad) / (ch + gap));
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    const i = y * COLS + x;
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
        hud.set("Pairs", `${pairs}/${(COLS * ROWS) / 2}`);
        open = [];
        sdk.haptic(30);
        if (pairs === (COLS * ROWS) / 2) setTimeout(finish, 350);
      } else {
        lock = 0.75;
      }
    }
  });

  function layout() {
    const pad = 14;
    const gap = 10;
    const cw = (gc.w - pad * 2 - gap * (COLS - 1)) / COLS;
    const ch = (gc.h - pad * 2 - gap * (ROWS - 1)) / ROWS;
    return { cw, ch, pad, gap };
  }

  gc.run((dt) => {
    if (lock > 0) {
      lock -= dt;
      if (lock <= 0) {
        for (const i of open) cards[i].state = "down";
        open = [];
      }
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const { cw, ch, pad, gap } = layout();
    cards.forEach((c, i) => {
      const x = pad + (i % COLS) * (cw + gap);
      const y = pad + Math.floor(i / COLS) * (ch + gap);
      if (c.state === "gone") {
        roundRect(ctx, x, y, cw, ch, 12, "rgba(6,214,160,0.15)");
        return;
      }
      if (c.state === "down") {
        roundRect(ctx, x, y, cw, ch, 12, palette.board);
        ctx.fillStyle = "rgba(255,248,236,0.25)";
        ctx.font = `800 ${cw * 0.4}px "Baloo 2", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", x + cw / 2, y + ch / 2 + 2);
      } else {
        roundRect(ctx, x, y, cw, ch, 12, palette.cream);
        ctx.font = `${cw * 0.5}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(c.face, x + cw / 2, y + ch / 2 + 2);
      }
    });
  });

  reset();
  return () => gc.destroy();
}
