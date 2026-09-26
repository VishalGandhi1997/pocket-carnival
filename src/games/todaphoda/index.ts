// Brick Smash — classic brick breaker. Drag to move the paddle, tap to launch
// the ball. Clearing a full wall is a level up: the next wall is built at the
// new level (faster ball, narrower paddle, more rows, tougher bricks) and the
// run keeps going. Lose a life when the ball drops; game over at 0 lives.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const COLS = 7;
const BALL_R = 7;
const START_LIVES = 3;

// ── Level curve ──
const speedMul = (level: number) => 1 + Math.min(0.6, (level - 1) * 0.07); // +7%/lvl, cap +60%
const paddleMul = (level: number) => 1 - Math.min(0.3, (level - 1) * 0.05); // −5%/lvl, cap −30%
const rowsFor = (level: number) => Math.min(8, 5 + Math.floor((level - 1) / 2));
// Share of 2-hit bricks: none before L3, then 15% climbing to a 50% cap.
const toughShare = (level: number) => (level < 3 ? 0 : Math.min(0.5, 0.15 + (level - 3) * 0.07));

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
  hp: number; // hits left (2 = tough brick)
  tough: boolean; // needed 2 hits — drawn darker, cracked after the first
}

export function mountTodaPhoda(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Score", "Lives", "Best"]);
  const gc = createGameCanvas(host, 1.4);
  const { ctx, w, h } = gc;

  let level = sdk.getLevel("todaphoda");
  let paddleW = w * 0.24 * paddleMul(level);
  const paddleH = 12;
  const paddleY = h - 40;

  let paddleX = w / 2;
  let ball = { x: w / 2, y: paddleY - BALL_R, vx: 0, vy: 0 };
  let launched = false;
  let bricks: Brick[] = [];
  let score = 0;
  let lives = START_LIVES;
  let speed = h * 0.62 * speedMul(level); // ball speed (px/s), set by level
  let over = false;
  let paused = false; // level-up overlay is up between walls
  let paidScore = 0; // score already paid out in coins this run

  // Build a wall of bricks for the current level.
  function buildWall() {
    const rows = rowsFor(level);
    const share = toughShare(level);
    bricks = [];
    const pad = 8;
    const gap = 5;
    const top = 60;
    const totalW = w - pad * 2;
    const bw = (totalW - gap * (COLS - 1)) / COLS;
    const bh = 20;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const tough = Math.random() < share;
        bricks.push({
          x: pad + c * (bw + gap),
          y: top + r * (bh + gap),
          w: bw,
          h: bh,
          color: palette.pieces[r % palette.pieces.length],
          alive: true,
          hp: tough ? 2 : 1,
          tough,
        });
      }
    }
  }

  // Park the ball on the paddle, waiting for a launch tap.
  function resetBall() {
    launched = false;
    ball = { x: paddleX, y: paddleY - BALL_R, vx: 0, vy: 0 };
  }

  // Apply the level's ball speed + paddle width.
  function applyLevel() {
    speed = h * 0.62 * speedMul(level);
    paddleW = w * 0.24 * paddleMul(level);
    paddleX = clamp(paddleX, paddleW / 2, w - paddleW / 2);
    hud.set("Level", level);
  }

  function reset() {
    level = sdk.getLevel("todaphoda");
    score = 0;
    paidScore = 0;
    lives = START_LIVES;
    over = false;
    paused = false;
    paddleX = w / 2;
    applyLevel();
    buildWall();
    resetBall();
    hud.set("Score", 0);
    hud.set("Lives", lives);
    hud.set("Best", sdk.getBest("todaphoda"));
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Launch the ball upward with a slight random horizontal lean.
  function launch() {
    if (launched || over || paused) return;
    launched = true;
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
  }

  gc.onDown((p) => {
    if (paused) return;
    paddleX = clamp(p.x, paddleW / 2, w - paddleW / 2);
    launch();
  });
  gc.onMove((p) => {
    if (paused) return;
    paddleX = clamp(p.x, paddleW / 2, w - paddleW / 2);
    if (!launched) ball.x = paddleX;
  });

  function loseLife() {
    lives -= 1;
    hud.set("Lives", lives);
    sdk.haptic(40);
    if (lives <= 0) return endGame();
    resetBall();
  }

  // Wall cleared → level up, pay out this wall's score, then pause on an
  // overlay; "Next Wall" builds a fresh wall at the new level.
  function wallCleared() {
    paused = true;
    launched = false;
    level += 1;
    sdk.setLevel("todaphoda", level);
    hud.set("Level", level);
    const coins = sdk.scaleReward(Math.max(1, Math.floor((score - paidScore) / 10)), level);
    paidScore = score;
    sdk.addCoins(coins, "Brick Smash");
    sdk.haptic(40);
    const tough = level >= 3 ? ", tougher bricks" : "";
    showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Wall cleared! Level ${level} — faster ball, narrower paddle${tough}`,
      coins,
      mood: "win",
      primaryLabel: "Next Wall ▶",
      onPrimary: () => {
        applyLevel();
        buildWall();
        resetBall();
        paused = false;
      },
    });
  }

  function endGame() {
    over = true;
    const isBest = sdk.submitScore("todaphoda", score);
    const coins = sdk.scaleReward(Math.max(1, Math.floor((score - paidScore) / 10)), level);
    paidScore = score;
    sdk.addCoins(coins, "Brick Smash");
    hud.set("Best", sdk.getBest("todaphoda"));
    sdk.haptic(60);
    const left = bricks.filter((b) => b.alive).length;
    showOverlay(gc.canvas, {
      title: "Game Over 🧱",
      subtitle: `Score ${score} · ${left} brick${left === 1 ? "" : "s"} left to reach Level ${level + 1}`,
      coins,
      isBest,
      mood: "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  // Advance the ball, bounce off walls/paddle/bricks. Split into small
  // sub-steps so a fast ball can't tunnel through a thin brick or paddle.
  function moveBall(step: number) {
    const dist = Math.hypot(ball.vx, ball.vy) * step;
    const subs = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)));
    const dtSub = step / subs;
    for (let s = 0; s < subs; s++) {
      ball.x += ball.vx * dtSub;
      ball.y += ball.vy * dtSub;

      // side + top walls
      if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
      if (ball.x > w - BALL_R) { ball.x = w - BALL_R; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

      // paddle — reflect with angle based on hit position
      if (ball.vy > 0 && ball.y + BALL_R >= paddleY && ball.y - BALL_R <= paddleY + paddleH &&
          Math.abs(ball.x - paddleX) < paddleW / 2 + BALL_R) {
        const rel = (ball.x - paddleX) / (paddleW / 2); // -1..1
        const bounce = rel * (Math.PI / 3); // up to 60° off vertical
        const sp = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.sin(bounce) * sp;
        ball.vy = -Math.cos(bounce) * sp;
        ball.y = paddleY - BALL_R;
        sdk.sfx("coin");
        sdk.haptic();
      }

      // bricks — reflect off the nearest side of the first brick hit
      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + b.w &&
            ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + b.h) {
          b.hp -= 1;
          if (b.hp <= 0) {
            b.alive = false;
            score += 10;
            sdk.sfx("pop");
          } else {
            score += 5; // cracked a tough brick
            sdk.sfx("tick");
          }
          hud.set("Score", score);
          sdk.haptic();
          // choose reflection axis by smallest overlap
          const overlapX = Math.min(ball.x + BALL_R - b.x, b.x + b.w - (ball.x - BALL_R));
          const overlapY = Math.min(ball.y + BALL_R - b.y, b.y + b.h - (ball.y - BALL_R));
          if (overlapX < overlapY) ball.vx = -ball.vx;
          else ball.vy = -ball.vy;
          break;
        }
      }

      // wall cleared → level up (next wall is built at the new level)
      if (bricks.every((b) => !b.alive)) { wallCleared(); return; }

      // fell below the paddle → lose a life (stop sub-stepping this frame)
      if (ball.y - BALL_R > h) { loseLife(); return; }
    }
  }

  gc.run((dt) => {
    if (!over && !paused && launched) {
      const stepT = Math.min(dt, 0.03);
      moveBall(stepT);
    } else if (!launched && !over && !paused) {
      ball.x = paddleX; // ball rides the paddle until launch
    }

    // ── draw ──
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);

    for (const b of bricks) {
      if (!b.alive) continue;
      roundRect(ctx, b.x, b.y, b.w, b.h, 5, b.color);
      if (b.tough) {
        // tough brick: darkened with a bright rim
        roundRect(ctx, b.x, b.y, b.w, b.h, 5, "rgba(20,12,40,0.45)");
        ctx.strokeStyle = "rgba(255,248,236,0.55)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
      }
      roundRect(ctx, b.x, b.y, b.w, b.h * 0.4, 5, "rgba(255,255,255,0.18)");
      if (b.tough && b.hp === 1) {
        // cracked after the first hit
        ctx.strokeStyle = "rgba(255,248,236,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.3, b.y + 2);
        ctx.lineTo(b.x + b.w * 0.45, b.y + b.h * 0.45);
        ctx.lineTo(b.x + b.w * 0.38, b.y + b.h * 0.7);
        ctx.lineTo(b.x + b.w * 0.52, b.y + b.h - 2);
        ctx.moveTo(b.x + b.w * 0.45, b.y + b.h * 0.45);
        ctx.lineTo(b.x + b.w * 0.68, b.y + b.h * 0.35);
        ctx.stroke();
      }
    }

    roundRect(ctx, paddleX - paddleW / 2, paddleY, paddleW, paddleH, 6, palette.teal);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, 7);
    ctx.fillStyle = palette.cream;
    ctx.fill();

    if (!launched && !over && !paused) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,248,236,0.7)";
      ctx.font = '700 16px "Baloo 2", sans-serif';
      ctx.fillText("Tap to launch 🚀", w / 2, paddleY - 26);
    }
  });

  reset();
  return () => gc.destroy();
}
