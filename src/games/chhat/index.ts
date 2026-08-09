// Chhat Pe Chhat — the classic "Stack" tower builder. A block slides back and
// forth at the top of the tower; TAP to drop it. Whatever overhangs the block
// below is sliced off (and falls away as debris), so the tower narrows with
// every imperfect placement. Miss the tower entirely and it topples.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

interface Block {
  x: number; // left edge, world/screen-x (px)
  w: number; // width (px)
  ci: number; // index into palette.pieces
}
// A sliced-off overhang that tumbles off the screen — pure eye candy.
interface Debris {
  x: number;
  y: number; // world-y (top edge)
  w: number;
  ci: number;
  vx: number;
  vy: number;
}

const PERFECT_PX = 6; // near-exact placements snap + reward a little width back
const PERFECT_GROW = 6; // px of width handed back on a perfect stack

export function mountChhat(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Height", "Best"]);
  const gc = createGameCanvas(host, 1.5); // portrait
  const { ctx } = gc;

  const blockH = Math.round(gc.h / 12); // ~10 blocks visible at once
  const baseW = Math.round(gc.w * 0.55);

  let tower: Block[] = [];
  let debris: Debris[] = [];
  let moving: Block & { dir: number } = { x: 0, w: baseW, ci: 0, dir: 1 };
  let speed = 0;
  let score = 0;
  let over = false;
  let camY = 0;

  // World-y (top edge) for the block at stack index i. Index 0 is the base and
  // sits at y=0; the tower grows upward into negative y.
  const worldTop = (i: number) => -i * blockH;
  // Camera keeps the active (moving) block pinned near the top third.
  const camTarget = () => gc.h * 0.3 + tower.length * blockH;

  function spawnMoving() {
    const below = tower[tower.length - 1];
    moving = {
      x: 0,
      w: below.w,
      ci: tower.length % palette.pieces.length,
      dir: 1,
    };
  }

  function reset() {
    tower = [{ x: (gc.w - baseW) / 2, w: baseW, ci: 0 }];
    debris = [];
    score = 0;
    speed = gc.w * 0.8; // px/sec, grows with each stack
    over = false;
    spawnMoving();
    camY = camTarget(); // snap camera on a fresh run
    hud.set("Height", 0);
    hud.set("Best", sdk.getBest("chhat"));
  }

  function drop() {
    if (over) return;
    const below = tower[tower.length - 1];
    const left = Math.max(below.x, moving.x);
    const right = Math.min(below.x + below.w, moving.x + moving.w);
    const overlap = right - left;

    // No overlap at all → the block missed the tower entirely.
    if (overlap <= 0) return gameOver();

    const idxY = worldTop(tower.length); // where this block lands
    let px = left;
    let pw = overlap;

    if (Math.abs(moving.x - below.x) < PERFECT_PX) {
      // Perfect placement: snap flush and hand a sliver of width back.
      pw = Math.min(below.w + PERFECT_GROW, baseW);
      px = below.x + below.w / 2 - pw / 2;
      sdk.sfx("clear");
      sdk.haptic(25);
    } else {
      // Slice the overhang off as falling debris (only one side can overhang,
      // since the moving block is never wider than the block below it).
      if (moving.x < below.x) {
        debris.push({ x: moving.x, y: idxY, w: below.x - moving.x, ci: moving.ci, vx: -60, vy: 0 });
      } else {
        const over2 = moving.x + moving.w - (below.x + below.w);
        debris.push({ x: below.x + below.w, y: idxY, w: over2, ci: moving.ci, vx: 60, vy: 0 });
      }
      sdk.sfx("pop");
      sdk.haptic();
    }

    tower.push({ x: px, w: pw, ci: moving.ci });
    score += 1;
    speed += gc.w * 0.02; // each stack speeds the slide slightly
    hud.set("Height", score);
    spawnMoving();
  }

  function gameOver() {
    over = true;
    sdk.haptic(60);
    const isBest = sdk.submitScore("chhat", score);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 3)), 1);
    sdk.addCoins(coins, "Chhat Pe Chhat");
    hud.set("Best", sdk.getBest("chhat"));
    showOverlay(gc.canvas, {
      title: "Toppled! 🏗️",
      subtitle: `Stacked ${score}`,
      coins,
      isBest,
      mood: "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.onDown(drop);

  function drawBlock(x: number, worldY: number, w: number, ci: number) {
    const y = worldY + camY;
    if (y > gc.h + blockH || y < -blockH * 2) return; // off-screen cull
    roundRect(ctx, x, y, w, blockH - 2, 5, palette.pieces[ci]);
    // A soft top highlight so the rainbow tower reads with a little depth.
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x + 4, y + 3, Math.max(0, w - 8), 3);
  }

  gc.run((dt) => {
    // ── update ──
    if (!over) {
      moving.x += moving.dir * speed * dt;
      const maxX = gc.w - moving.w;
      if (moving.x <= 0) {
        moving.x = 0;
        moving.dir = 1;
      } else if (moving.x >= maxX) {
        moving.x = maxX;
        moving.dir = -1;
      }
    }
    // debris falls under gravity, then is retired once well below view
    for (const d of debris) {
      d.vy += 900 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    debris = debris.filter((d) => d.y + camY < gc.h + blockH * 3);
    // smooth camera follow
    camY += (camTarget() - camY) * Math.min(1, dt * 6);

    // ── draw ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);

    for (let i = 0; i < tower.length; i++) drawBlock(tower[i].x, worldTop(i), tower[i].w, tower[i].ci);
    for (const d of debris) drawBlock(d.x, d.y, d.w, d.ci);
    if (!over) drawBlock(moving.x, worldTop(tower.length), moving.w, moving.ci);
  });

  reset();
  return () => gc.destroy();
}
