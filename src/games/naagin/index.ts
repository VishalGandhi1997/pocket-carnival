// Serpent — classic snake. Swipe (or arrow keys) to steer, eat glowing
// orbs, don't bite yourself. Speeds up as you grow.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay, showRevive } from "../../engine/ui";
import { reviveCost, ECONOMY } from "../../sdk/economy";
import type { Sdk } from "../../sdk/platform";

const N = 15;
type Dir = "up" | "down" | "left" | "right";
const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const OPPOSITE: Record<Dir, Dir> = {
  up: "down", down: "up", left: "right", right: "left",
};

// Higher level → faster start speed. Level up when a run beats the target.
const startInterval = (level: number) => Math.max(0.1, 0.18 - (level - 1) * 0.012);
const levelUpAt = (level: number) => 40 + level * 25;

export function mountNaagin(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Score", "Best"]);
  let level = sdk.getLevel("naagin");
  const gc = createGameCanvas(host, 1.0);
  const { ctx } = gc;

  let snake: number[][] = [];
  let dir: Dir = "right";
  let nextDir: Dir = "right";
  let food: number[] = [];
  let score = 0;
  let tick = 0;
  let interval = 0.18;
  let over = false;
  let reviveCount = 0;
  let usedAdRevive = false;

  function reset() {
    level = sdk.getLevel("naagin");
    snake = [[7, 7], [6, 7], [5, 7]];
    dir = "right";
    nextDir = "right";
    score = 0;
    interval = startInterval(level);
    over = false;
    reviveCount = 0;
    usedAdRevive = false;
    placeFood();
    hud.set("Level", level);
    hud.set("Score", 0);
    hud.set("Best", sdk.getBest("naagin"));
  }

  function placeFood() {
    do {
      food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
    } while (snake.some(([x, y]) => x === food[0] && y === food[1]));
  }

  function step() {
    dir = nextDir;
    const [dx, dy] = DELTA[dir];
    const head = [snake[0][0] + dx, snake[0][1] + dy];
    const hitWall = head[0] < 0 || head[0] >= N || head[1] < 0 || head[1] >= N;
    const hitSelf = snake.some(([x, y]) => x === head[0] && y === head[1]);
    if (hitWall || hitSelf) return gameOver();
    snake.unshift(head);
    if (head[0] === food[0] && head[1] === food[1]) {
      score += 5;
      interval = Math.max(0.07, interval - 0.004);
      hud.set("Score", score);
      sdk.haptic();
      placeFood();
    } else {
      snake.pop();
    }
  }

  // Revive restores a short snake at centre (moving right into open space)
  // while keeping the score you're protecting.
  function doRevive() {
    snake = [[7, 7], [6, 7], [5, 7]];
    dir = "right";
    nextDir = "right";
    tick = 0;
    placeFood();
    over = false;
  }

  function gameOver() {
    over = true;
    sdk.haptic(60);
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
    const isBest = sdk.submitScore("naagin", score);
    const leveledUp = score >= levelUpAt(level);
    if (leveledUp) {
      level += 1;
      sdk.setLevel("naagin", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / ECONOMY.reward.scoreDivisor)), level);
    sdk.addCoins(coins, "Serpent");
    hud.set("Best", sdk.getBest("naagin"));
    hud.set("Level", level);
    sdk.haptic(60);
    const need = levelUpAt(level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Ouch! 🐍",
      subtitle: leveledUp
        ? `Now Level ${level} — faster snake, bigger coins`
        : `Score ${score} · ${Math.max(0, need - score)} more to reach Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.onSwipe((d) => {
    if (d !== OPPOSITE[dir]) nextDir = d;
  });

  let foodPulse = 0;
  gc.run((dt) => {
    if (!over) {
      tick += dt;
      if (tick >= interval) {
        tick = 0;
        step();
      }
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const pad = 8;
    const cell = (gc.w - pad * 2) / N;
    // subtle checker
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if ((x + y) % 2 === 0)
          roundRect(ctx, pad + x * cell, pad + y * cell, cell, cell, 3, "rgba(255,248,236,0.03)");
    // food — a bright glowing orb that pulses so it's impossible to miss
    foodPulse += dt * 5;
    const fx = pad + food[0] * cell + cell / 2;
    const fy = pad + food[1] * cell + cell / 2;
    const fr = cell * (0.36 + Math.sin(foodPulse) * 0.06);
    ctx.save();
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, 7);
    ctx.fillStyle = "#ffcf33"; // bright gold — high contrast on the indigo board
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff3c4";
    ctx.stroke();
    // little specular highlight so it reads as a shiny orb
    ctx.beginPath();
    ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.22, 0, 7);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();

    // snake — colours come from the equipped skin (head / body / alt stripe)
    const skin = sdk.skinColors("naagin");
    snake.forEach(([x, y], i) => {
      const c = i === 0 ? skin.head : i % 2 === 0 ? skin.body : skin.alt;
      roundRect(ctx, pad + x * cell + 1, pad + y * cell + 1, cell - 2, cell - 2, i === 0 ? 8 : 5, c);
      if (i === 0) {
        ctx.fillStyle = palette.ink;
        const [dx, dy] = DELTA[dir];
        ctx.beginPath();
        ctx.arc(pad + x * cell + cell / 2 + dx * 3, pad + y * cell + cell / 2 + dy * 3, cell * 0.1, 0, 7);
        ctx.fill();
      }
    });
  });

  reset();
  return () => gc.destroy();
}
