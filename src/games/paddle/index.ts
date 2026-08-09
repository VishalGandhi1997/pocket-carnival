// Paddle Panga — same-screen pong duel. Vs Bot: drag anywhere to steer
// your paddle. Pass & Play: two people hold the phone from opposite
// ends — bottom half controls your paddle, top half controls theirs,
// using true simultaneous multi-touch (not the single-pointer helper).
import { createGameCanvas, localPoint, palette, roundRect } from "../../engine/canvas";
import { makeTurnBanner, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const WIN_SCORE = 5;
const PADDLE_W_RATIO = 0.26;
const BALL_R = 8;

export function mountPaddlePanga(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  const banner = makeTurnBanner(host);
  banner.set(mode === "bot" ? "First to 5 — drag to move" : "Both hold the phone — drag your end", "neutral");
  const gc = createGameCanvas(host, 1.5);
  const { ctx, canvas, w, h } = gc;

  const paddleW = w * PADDLE_W_RATIO;
  const paddleH = 12;
  const margin = 22;

  let botX = w / 2;
  let youX = w / 2;
  let ball = { x: w / 2, y: h / 2, vx: 0, vy: 0 };
  let scoreYou = 0;
  let scoreOpp = 0;
  let over = false;
  let serveDelay = 0.6;

  function serve(dir: 1 | -1) {
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
    const speed = h * 0.55;
    ball = {
      x: w / 2,
      y: h / 2,
      vx: Math.sin(angle) * speed,
      vy: Math.cos(angle) * speed * dir,
    };
  }

  function reset() {
    scoreYou = 0;
    scoreOpp = 0;
    over = false;
    botX = w / 2;
    youX = w / 2;
    serveDelay = 0.6;
    serve(Math.random() < 0.5 ? 1 : -1);
    banner.set(mode === "bot" ? "First to 5 — drag to move" : "Both hold the phone — drag your end", "neutral");
  }

  // ── Multi-touch tracking (bypasses the engine's single-pointer input) ──
  const touches = new Map<number, { x: number; zone: "top" | "bottom" }>();

  function onDown(e: PointerEvent) {
    e.preventDefault();
    const p = localPoint(canvas, e, w, h);
    const zone: "top" | "bottom" = p.y < h / 2 ? "top" : "bottom";
    touches.set(e.pointerId, { x: p.x, zone });
  }
  function onMove(e: PointerEvent) {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const p = localPoint(canvas, e, w, h);
    t.x = p.x;
  }
  function onUp(e: PointerEvent) {
    touches.delete(e.pointerId);
  }
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  function latestInZone(zone: "top" | "bottom"): number | null {
    let found: number | null = null;
    for (const t of touches.values()) if (t.zone === zone) found = t.x;
    return found;
  }

  function endGame() {
    over = true;
    const youWon = scoreYou > scoreOpp;
    const coins = youWon ? 22 : 6;
    if (youWon) sdk.submitScore("paddle", sdk.getBest("paddle") + 1);
    sdk.addCoins(coins, "Paddle Panga");
    banner.set(youWon ? "🏆 You Won!" : "You Lost", youWon ? "you" : "opp");
    showOverlay(gc.canvas, {
      title: youWon ? "You Won! 🏆" : "So Close!",
      subtitle: `${scoreYou} – ${scoreOpp}`,
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.run((dt) => {
    if (!over) {
      // your paddle: any touch in bot mode, or bottom-zone touch in pnp mode
      const yourTouch = mode === "bot" ? latestZoneAny() : latestInZone("bottom");
      if (yourTouch !== null) youX = clamp(yourTouch, paddleW / 2, w - paddleW / 2);

      if (mode === "bot") {
        const target = clamp(ball.x, paddleW / 2, w - paddleW / 2);
        const maxStep = h * 0.9 * dt;
        botX += clamp(target - botX, -maxStep, maxStep);
      } else {
        const oppTouch = latestInZone("top");
        if (oppTouch !== null) botX = clamp(oppTouch, paddleW / 2, w - paddleW / 2);
      }

      if (serveDelay > 0) {
        serveDelay -= dt;
      } else {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
        if (ball.x > w - BALL_R) { ball.x = w - BALL_R; ball.vx = -Math.abs(ball.vx); }

        // bottom paddle (you) collision
        if (ball.vy > 0 && ball.y > h - margin - paddleH && ball.y < h - margin + paddleH &&
            Math.abs(ball.x - youX) < paddleW / 2 + BALL_R) {
          ball.vy = -Math.abs(ball.vy) * 1.03;
          ball.vx += ((ball.x - youX) / (paddleW / 2)) * 90;
          sdk.haptic();
        }
        // top paddle collision
        if (ball.vy < 0 && ball.y < margin + paddleH && ball.y > margin - paddleH &&
            Math.abs(ball.x - botX) < paddleW / 2 + BALL_R) {
          ball.vy = Math.abs(ball.vy) * 1.03;
          ball.vx += ((ball.x - botX) / (paddleW / 2)) * 90;
          sdk.haptic();
        }

        if (ball.y < -BALL_R * 2) {
          scoreYou++;
          sdk.haptic(30);
          if (scoreYou >= WIN_SCORE) endGame();
          else { serveDelay = 0.6; serve(1); }
        } else if (ball.y > h + BALL_R * 2) {
          scoreOpp++;
          sdk.haptic(30);
          if (scoreOpp >= WIN_SCORE) endGame();
          else { serveDelay = 0.6; serve(-1); }
        }
      }
    }

    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, 18, palette.bg);
    roundRect(ctx, 0, h / 2 - 1, w, 2, 0, "rgba(255,255,255,0.08)");

    // scores
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,248,236,0.5)";
    ctx.font = '800 28px "Baloo 2", sans-serif';
    ctx.fillText(String(scoreOpp), w / 2, h / 2 - 24);
    ctx.fillText(String(scoreYou), w / 2, h / 2 + 42);

    // paddles
    roundRect(ctx, botX - paddleW / 2, margin - paddleH / 2, paddleW, paddleH, 6, palette.pink);
    roundRect(ctx, youX - paddleW / 2, h - margin - paddleH / 2, paddleW, paddleH, 6, palette.teal);

    // ball
    if (serveDelay <= 0 || Math.floor(serveDelay * 6) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, 7);
      ctx.fillStyle = palette.marigold;
      ctx.fill();
    }
  });

  function latestZoneAny(): number | null {
    let found: number | null = null;
    for (const t of touches.values()) found = t.x;
    return found;
  }
  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  reset();
  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    gc.destroy();
  };
}
