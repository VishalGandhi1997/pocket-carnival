// Patta Party — free-play card flip battle. Both sides flip their top card
// at the same moment; the higher rank takes the trick. Matching ranks spark
// a DHAMAKA: the next trick counts double (and stacks on repeats). 26 flips,
// most tricks wins the match. Modes are cosmetic (flips are simultaneous):
// vs Bot, or Pass & Play sharing one phone. Friendly battle — no stakes.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, makeTurnBanner, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

interface Card {
  rank: number; // 2–14, Ace (14) high
  suit: "♠" | "♥" | "♦" | "♣";
}

const SUITS: Card["suit"][] = ["♠", "♥", "♦", "♣"];
const FACE: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const rankLabel = (r: number) => FACE[r] ?? String(r);
const suitColor = (s: Card["suit"]) => (s === "♥" || s === "♦" ? palette.pink : palette.ink);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Shuffle a fresh 52-card deck and split it 26/26. */
function dealDecks(): [Card[], Card[]] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return [deck.slice(0, 26), deck.slice(26)];
}

export function mountPatta(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  const oppName = mode === "bot" ? "🤖 Bot" : "Player 2";
  const hud = makeHud(host, ["You", "Them"]);
  const banner = makeTurnBanner(host);
  const gc = createGameCanvas(host, 1.2);
  const { ctx } = gc;

  // ── layout (CSS px) ──
  const W = gc.w, H = gc.h;
  const cw = W * 0.34, chh = cw * 1.45; // big revealed card
  const pw = W * 0.15, ph = pw * 1.45; // pile card-back
  const slotY = H / 2 - chh / 2;
  const youSlotX = W * 0.28 - cw / 2;
  const themSlotX = W * 0.72 - cw / 2;
  const youPile = { x: W * 0.05, y: H - ph - H * 0.06 };
  const themPile = { x: W * 0.95 - pw, y: H * 0.035 };

  let deckYou: Card[] = [], deckThem: Card[] = [];
  let tricksYou = 0, tricksThem = 0;
  let mult = 1; // DHAMAKA multiplier for the next trick
  let flips = 0;
  let over = false, busy = false;
  let current: { you: Card; them: Card; t: number } | null = null;
  let prev: { you: Card; them: Card; alpha: number } | null = null;
  let endTimer = 0;

  function reset() {
    [deckYou, deckThem] = dealDecks();
    tricksYou = tricksThem = 0;
    mult = 1; flips = 0;
    over = busy = false;
    current = prev = null;
    hud.set("You", 0); hud.set("Them", 0);
    banner.set(`You vs ${oppName} — Tap Flip!`, "neutral");
  }

  function flip() {
    if (over || busy) return;
    const you = deckYou.pop(), them = deckThem.pop();
    if (!you || !them) return;
    if (current) prev = { you: current.you, them: current.them, alpha: 1 };
    current = { you, them, t: 0 };
    busy = true;
    flips++;
    sdk.haptic();
  }

  function resolve(you: Card, them: Card) {
    busy = false;
    if (you.rank === them.rank) {
      mult *= 2;
      banner.set(`🔥 DHAMAKA! Next trick worth ×${mult}`, "neutral");
      sdk.haptic(30);
    } else {
      const youTook = you.rank > them.rank;
      if (youTook) tricksYou += mult; else tricksThem += mult;
      banner.set(
        youTook
          ? mult > 1 ? `⚡ You sweep ×${mult} tricks!` : "✨ You take the trick!"
          : mult > 1 ? `${oppName} sweeps ×${mult} tricks` : `${oppName} takes it`,
        youTook ? "you" : "opp",
      );
      sdk.sfx("coin");
      mult = 1;
    }
    hud.set("You", tricksYou); hud.set("Them", tricksThem);
    if (deckYou.length === 0) {
      over = true;
      endTimer = window.setTimeout(finish, 950); // let the last trick land
    }
  }

  function finish() {
    const tie = tricksYou === tricksThem;
    const youWon = tricksYou > tricksThem;
    const coins = youWon ? sdk.scaleReward(20, 1) : 5;
    if (youWon) sdk.submitScore("patta", sdk.getBest("patta") + 1);
    sdk.addCoins(coins, "Patta Party");
    banner.set(youWon ? "🏆 You won the match!" : tie ? "All square!" : `${oppName} takes the match`, youWon ? "you" : "opp");
    showOverlay(gc.canvas, {
      title: youWon ? "Patta Badshah! 🂡" : tie ? "All Square" : "Cards Down!",
      subtitle: `${tricksYou} – ${tricksThem}`,
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Deal Again",
      onPrimary: reset,
    });
  }

  // ── controls: one shared Flip button — both cards reveal at once ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const flipBtn = document.createElement("button");
  flipBtn.className = "btn-primary";
  flipBtn.textContent = mode === "pnp" ? "🃏 Both Flip" : "🃏 Flip";
  flipBtn.addEventListener("click", flip);
  controls.appendChild(flipBtn);
  host.appendChild(controls);

  // ── drawing ──
  function drawFace(x: number, y: number, w: number, card: Card, alpha: number) {
    const h = w * 1.45;
    ctx.globalAlpha = alpha;
    roundRect(ctx, x + 3, y + 4, w, h, w * 0.1, "rgba(0,0,0,0.28)");
    roundRect(ctx, x, y, w, h, w * 0.1, "#ffffff");
    ctx.fillStyle = suitColor(card.suit);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = `800 ${w * 0.24}px "Nunito Sans", sans-serif`;
    ctx.fillText(rankLabel(card.rank), x + w * 0.09, y + w * 0.07);
    ctx.font = `${w * 0.2}px "Nunito Sans", sans-serif`;
    ctx.fillText(card.suit, x + w * 0.1, y + w * 0.36);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `${w * 0.5}px "Nunito Sans", sans-serif`;
    ctx.fillText(card.suit, x + w / 2, y + h * 0.66);
    ctx.globalAlpha = 1;
  }

  function drawPile(px: number, py: number, count: number, alignRight: boolean) {
    if (count > 0) {
      for (let i = Math.min(2, count - 1); i >= 0; i--)
        roundRect(ctx, px - i * 2.5, py - i * 2.5, pw, ph, 7, i === 0 ? palette.sky : "#2f86b3");
      roundRect(ctx, px + 4, py + 4, pw - 8, ph - 8, 5, "rgba(255,255,255,0.22)");
    } else {
      ctx.strokeStyle = "rgba(255,248,236,0.3)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 7);
      ctx.stroke();
    }
    ctx.fillStyle = palette.cream;
    ctx.textAlign = alignRight ? "right" : "left"; ctx.textBaseline = "top";
    ctx.font = `700 ${W * 0.036}px "Nunito Sans", sans-serif`;
    ctx.fillText(`${count} left`, alignRight ? px + pw : px, py + ph + 6);
  }

  gc.run((dt) => {
    if (current && current.t < 1) {
      current.t = Math.min(1, current.t + dt / 0.25); // ~0.25s slide-in
      if (current.t >= 1) resolve(current.you, current.them);
    }
    if (prev && (prev.alpha -= dt * 2.2) <= 0) prev = null; // old trick fades under the new cards

    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 0, 0, W, H, 18, palette.bg);
    roundRect(ctx, W * 0.04, slotY - H * 0.03, W * 0.92, chh + H * 0.06, 16, palette.board);

    drawPile(youPile.x, youPile.y, deckYou.length, false);
    drawPile(themPile.x, themPile.y, deckThem.length, true);

    ctx.fillStyle = "rgba(255,248,236,0.7)";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = `700 ${W * 0.038}px "Nunito Sans", sans-serif`;
    ctx.fillText(`Flip ${flips}/26`, W * 0.05, H * 0.03);

    if (prev) {
      drawFace(youSlotX, slotY, cw, prev.you, prev.alpha * 0.55);
      drawFace(themSlotX, slotY, cw, prev.them, prev.alpha * 0.55);
    }
    if (current) {
      const e = easeOut(current.t);
      drawFace(lerp(youPile.x, youSlotX, e), lerp(youPile.y, slotY, e), lerp(pw, cw, e), current.you, 1);
      drawFace(lerp(themPile.x, themSlotX, e), lerp(themPile.y, slotY, e), lerp(pw, cw, e), current.them, 1);
      if (current.t >= 1 && current.you.rank !== current.them.rank) {
        // teal ring around the trick winner's card
        ctx.strokeStyle = palette.teal; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect((current.you.rank > current.them.rank ? youSlotX : themSlotX) - 3, slotY - 3, cw + 6, chh + 6, cw * 0.1);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(255,248,236,0.85)";
    ctx.font = `800 ${W * 0.04}px "Nunito Sans", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("You", W * 0.28, slotY + chh + 10);
    ctx.textBaseline = "bottom";
    ctx.fillText(oppName, W * 0.72, slotY - 10);

    if (mult > 1) {
      // DHAMAKA badge — the next trick is worth ×mult
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W * 0.055, 0, 7);
      ctx.fillStyle = palette.pink;
      ctx.fill();
      ctx.strokeStyle = palette.marigold; ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = palette.cream;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `800 ${W * 0.042}px "Nunito Sans", sans-serif`;
      ctx.fillText(`×${mult}`, W / 2, H / 2 + 1);
    }
  });

  reset();

  return () => {
    window.clearTimeout(endTimer);
    gc.destroy();
  };
}
