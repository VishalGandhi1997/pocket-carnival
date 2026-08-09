// Toda Phoda — classic brick breaker. Drag to move the paddle, tap to launch
// the ball. Clear every brick to spawn a fresh, denser wall and keep going
// (endless). Lose a life when the ball drops; game over at 0 lives.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const COLS = 7;
const ROWS = 5;
const BALL_R = 7;
const START_LIVES = 3;

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

export function mountTodaPhoda(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Score", "Lives", "Best"]);
  const gc = createGameCanvas(host, 1.4);
  const { ctx, w, h } = gc;

  const paddleW = w * 0.24;
  const paddleH = 12;
  const paddleY = h - 40;

  let paddleX = w / 2;
  let ball = { x: w / 2, y: paddleY - BALL_R, vx: 0, vy: 0 };
  let launched = false;
  let bricks: Brick[] = [];
  let score = 0;
  let lives = START_LIVES;
  let speed = h * 0.62; // base ball speed (px/s), rises as walls are cleared
  let over = false;

  // Build a wall of bricks. `rows` grows on each clear so play gets denser.
  function buildWall(rows: number) {
    bricks = [];
    const pad = 8;
    const gap = 5;
    const top = 60;
    const totalW = w - pad * 2;
    const bw = (totalW - gap * (COLS - 1)) / COLS;
    const bh = 20;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({
          x: pad + c * (bw + gap),
          y: top + r * (bh + gap),
          w: bw,
          h: bh,
          color: palette.pieces[r % palette.pieces.length],
          alive: true,
        });
      }
    }
  }

  // Park the ball on the paddle, waiting for a launch tap.
  function resetBall() {
    launched = false;
    ball = { x: paddleX, y: paddleY - BALL_R, vx: 0, vy: 0 };
  }

  function reset() {
    score = 0;
    lives = START_LIVES;
    speed = h * 0.62;
    over = false;
    paddleX = w / 2;
    buildWall(ROWS);
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
    if (launched || over) return;
    launched = true;
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
  }

  gc.onDown((p) => {
    paddleX = clamp(p.x, paddleW / 2, w - paddleW / 2);
    launch();
  });
  gc.onMove((p) => {
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

  function endGame() {
    over = true;
    const isBest = sdk.submitScore("todaphoda", score);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 10)), 1);
    sdk.addCoins(coins, "Toda Phoda");
    hud.set("Best", sdk.getBest("todaphoda"));
    sdk.haptic(60);
    showOverlay(gc.canvas, {
      title: "Game Over 🧱",
      subtitle: `Score ${score}`,
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
          b.alive = false;
          score += 10;
          hud.set("Score", score);
          sdk.sfx("pop");
          sdk.haptic();
          // choose reflection axis by smallest overlap
          const overlapX = Math.min(ball.x + BALL_R - b.x, b.x + b.w - (ball.x - BALL_R));
          const overlapY = Math.min(ball.y + BALL_R - b.y, b.y + b.h - (ball.y - BALL_R));
          if (overlapX < overlapY) ball.vx = -ball.vx;
          else ball.vy = -ball.vy;
          break;
        }
      }

      // wall cleared → denser, slightly faster refill
      if (bricks.every((b) => !b.alive)) {
        speed *= 1.08;
        const nextRows = Math.min(ROWS + 3, ROWS + Math.floor(score / 350) + 1);
        buildWall(nextRows);
        const sp = Math.hypot(ball.vx, ball.vy) || speed;
        const k = speed / sp;
        ball.vx *= k;
        ball.vy *= k;
      }

      // fell below the paddle → lose a life (stop sub-stepping this frame)
      if (ball.y - BALL_R > h) { loseLife(); return; }
    }
  }

  gc.run((dt) => {
    if (!over && launched) {
      const stepT = Math.min(dt, 0.03);
      moveBall(stepT);
    } else if (!launched && !over) {
      ball.x = paddleX; // ball rides the paddle until launch
    }

    // ── draw ──
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);

    for (const b of bricks) {
      if (!b.alive) continue;
      roundRect(ctx, b.x, b.y, b.w, b.h, 5, b.color);
      roundRect(ctx, b.x, b.y, b.w, b.h * 0.4, 5, "rgba(255,255,255,0.18)");
    }

    roundRect(ctx, paddleX - paddleW / 2, paddleY, paddleW, paddleH, 6, palette.teal);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, 7);
    ctx.fillStyle = palette.cream;
    ctx.fill();

    if (!launched && !over) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,248,236,0.7)";
      ctx.font = '700 16px "Baloo 2", sans-serif';
      ctx.fillText("Tap to launch 🚀", w / 2, paddleY - 26);
    }
  });

  reset();
  return () => gc.destroy();
}
