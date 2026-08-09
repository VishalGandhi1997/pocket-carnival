// Sanp Sidhi — Snakes & Ladders. Classic public-domain board race.
// Roll dice, climb ladders, avoid snakes, first to square 100 wins.
// Modes: vs Bot (auto-rolls) or Pass & Play (hand the phone over).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeTurnBanner, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const LADDERS: Record<number, number> = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
const SNAKES: Record<number, number> = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 95: 72, 98: 79 };

function cellPos(n: number) {
  const idx = n - 1;
  const row = Math.floor(idx / 10);
  let col = idx % 10;
  if (row % 2 === 1) col = 9 - col;
  return { gx: col, gy: 9 - row };
}

export function mountSanpSidhi(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  const banner = makeTurnBanner(host);
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  const players = [
    { name: "You", color: palette.marigold, pos: 0 },
    { name: mode === "bot" ? "Bot" : "Player 2", color: palette.pink, pos: 0 },
  ];
  let turn = 0;
  let dice = 1;
  let rolling = false;
  let anim: { from: number; to: number; t: number; player: number } | null = null;
  let over = false;

  function refreshBanner(rolledSix = false) {
    if (over) return;
    const again = rolledSix ? " · Rolled a 6, go again!" : "";
    if (turn === 0) banner.set(`🎲 Your Turn — Roll!${again}`, "you");
    else banner.set((mode === "bot" ? "🤖 Bot is thinking…" : "🎲 Player 2's Turn — Roll!") + again, "opp");
  }

  function roll() {
    if (rolling || over) return;
    rolling = true;
    let ticks = 0;
    const spin = setInterval(() => {
      dice = 1 + Math.floor(Math.random() * 6);
      diceFace.textContent = DICE_FACES[dice];
      ticks++;
      if (ticks > 8) {
        clearInterval(spin);
        applyRoll();
      }
    }, 60);
  }

  function applyRoll() {
    const p = players[turn];
    const target = p.pos + dice;
    sdk.haptic();
    if (target > 100) {
      rolling = false;
      nextTurn(dice === 6);
      return;
    }
    anim = { from: p.pos, to: target, t: 0, player: turn };
  }

  function landOn(playerIdx: number, square: number) {
    let final = square;
    if (LADDERS[square]) final = LADDERS[square];
    else if (SNAKES[square]) final = SNAKES[square];
    players[playerIdx].pos = final;
    if (final === 100) return win(playerIdx);
    rolling = false;
    nextTurn(dice === 6);
  }

  function nextTurn(again: boolean) {
    if (!again) turn = 1 - turn;
    refreshBanner(again);
    if (mode === "bot" && turn === 1 && !over) setTimeout(roll, 700);
  }

  function win(idx: number) {
    over = true;
    const youWon = idx === 0;
    const coins = youWon ? 30 : 5;
    if (youWon) sdk.submitScore("sanpsidhi", sdk.getBest("sanpsidhi") + 1);
    sdk.addCoins(coins, "Sanp Sidhi");
    banner.set(youWon ? "🏆 You Won!" : `${players[idx].name} Won`, youWon ? "you" : "opp");
    showOverlay(gc.canvas, {
      title: youWon ? "You Won! 🏆" : `${players[idx].name} Wins`,
      subtitle: "First to square 100",
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function reset() {
    players[0].pos = 0;
    players[1].pos = 0;
    turn = 0;
    over = false;
    rolling = false;
    anim = null;
    refreshBanner();
  }

  // dice face + roll button
  const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const diceFace = document.createElement("div");
  diceFace.style.cssText =
    "font-size:44px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(255,255,255,0.92);border-radius:16px;box-shadow:0 4px 0 rgba(0,0,0,0.25);color:#241f3d;";
  diceFace.textContent = DICE_FACES[1];
  const diceBtn = document.createElement("button");
  diceBtn.className = "btn-primary";
  diceBtn.textContent = "🎲 Roll Dice";
  diceBtn.addEventListener("click", () => {
    const humanTurn = turn === 0 || mode === "pnp";
    if (humanTurn && !rolling && !over) roll();
  });
  controls.append(diceFace, diceBtn);
  host.appendChild(controls);

  gc.run((dt) => {
    if (anim) {
      anim.t += dt * 2.4;
      if (anim.t >= 1) {
        const { player, to } = anim;
        players[player].pos = to;
        anim = null;
        landOn(player, to);
      }
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const pad = 8;
    const cell = (gc.w - pad * 2) / 10;

    for (let n = 1; n <= 100; n++) {
      const { gx, gy } = cellPos(n);
      const shade = (gx + gy) % 2 === 0 ? "#4e3c9c" : palette.board;
      roundRect(ctx, pad + gx * cell + 1, pad + gy * cell + 1, cell - 2, cell - 2, 5, shade);
      ctx.fillStyle = "rgba(255,248,236,0.55)";
      ctx.font = `700 ${cell * 0.24}px "Nunito Sans", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(n), pad + gx * cell + 4, pad + gy * cell + 3);
    }

    // ladders (gold lines) and snakes (pink dashed)
    ctx.lineWidth = 4;
    for (const [from, to] of Object.entries(LADDERS)) {
      const a = cellPos(Number(from)), b = cellPos(Number(to));
      ctx.strokeStyle = palette.teal;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pad + a.gx * cell + cell / 2, pad + a.gy * cell + cell / 2);
      ctx.lineTo(pad + b.gx * cell + cell / 2, pad + b.gy * cell + cell / 2);
      ctx.stroke();
    }
    for (const [from, to] of Object.entries(SNAKES)) {
      const a = cellPos(Number(from)), b = cellPos(Number(to));
      ctx.strokeStyle = palette.pink;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(pad + a.gx * cell + cell / 2, pad + a.gy * cell + cell / 2);
      ctx.lineTo(pad + b.gx * cell + cell / 2, pad + b.gy * cell + cell / 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // tokens
    players.forEach((p, i) => {
      const pos = anim && anim.player === i ? lerp(anim.from, anim.to, easeOut(anim.t)) : p.pos;
      if (pos <= 0) return;
      const { gx, gy } = cellPos(Math.round(pos));
      const ox = i === 0 ? -cell * 0.18 : cell * 0.18;
      ctx.beginPath();
      ctx.arc(pad + gx * cell + cell / 2 + ox, pad + gy * cell + cell / 2, cell * 0.22, 0, 7);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });

  refreshBanner();

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }
  function easeOut(t: number) {
    return 1 - (1 - t) * (1 - t);
  }

  return () => gc.destroy();
}
