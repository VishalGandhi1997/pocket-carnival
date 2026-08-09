// Carrom Clash — simplified flick carrom. Slingshot the cream striker from
// your baseline to knock pucks into the corner pockets: teal pucks score for
// you, pink for the opponent, the gold queen is +3 to whoever sinks her.
// Modes: vs Bot (bot shoots from the top) or Pass & Play (view doesn't flip —
// Player 2 also shoots from the top baseline).
import { createGameCanvas, palette, roundRect, type Pointer } from "../../engine/canvas";
import { makeHud, makeTurnBanner, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

type Kind = "you" | "opp" | "queen" | "striker";
interface Piece {
  x: number; y: number; vx: number; vy: number; r: number; kind: Kind; alive: boolean;
}

const FRAME_COLOR = "#8a5a3b"; // dark wooden frame
const INNER_COLOR = "#cd9a63"; // lighter playing surface
const QUEEN_GOLD = "#ffd166";
const REST = 0.8;       // wall restitution: normal component keeps 80% of its speed
const FRICTION = 0.985; // cloth drag per 1/120 s physics sub-step (frame-rate scaled below)
const STOP_EPS = 6;     // px/s — below this a piece snaps to a full stop

export function mountCarrom(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  const oppLbl = mode === "bot" ? "🤖 Bot" : "🧑 P2";
  const hud = makeHud(host, ["⚪ You", oppLbl]);
  const banner = makeTurnBanner(host);
  const gc = createGameCanvas(host, 1.0); // square board
  const { ctx, w } = gc;

  // ── Board geometry (everything scales off the square width) ──
  const FR = w * 0.075;      // frame thickness = wall position
  const PR = w / 16;         // pocket radius
  const pk = FR + PR * 0.9;  // pocket centers tucked into the corners
  const POCKETS = [{ x: pk, y: pk }, { x: w - pk, y: pk }, { x: pk, y: w - pk }, { x: w - pk, y: w - pk }];
  const pr = w * 0.034;      // puck radius
  const sr = w * 0.046;      // striker radius (slightly bigger)
  const baseY = (s: number) => (s === 0 ? w - FR - w * 0.16 : FR + w * 0.16); // shooting lines
  const xMin = FR + PR * 2, xMax = w - FR - PR * 2; // striker travel along the baseline
  const MAX_PULL = w * 0.42; // drag length that gives a full-power shot
  const MAX_V = w * 2.6;     // launch speed at full pull (px/s)

  let pieces: Piece[] = [];
  const striker: Piece = { x: w / 2, y: baseY(0), vx: 0, vy: 0, r: sr, kind: "striker", alive: true };
  let turn: 0 | 1 = 0;
  let phase: "aim" | "moving" | "over" = "aim";
  let scoreYou = 0, scoreOpp = 0;
  let pottedOwn = false; // shooter sank one of their own colour this shot → shoot again
  let aiming = false;
  let drag: Pointer | null = null;
  let sfxCool = 0;       // throttles collision clacks
  let botTimer = 0;

  function buildPieces() {
    const c = w / 2;
    pieces = [{ x: c, y: c, vx: 0, vy: 0, r: pr, kind: "queen", alive: true }];
    for (let i = 0; i < 8; i++) { // ring of 8 alternating pucks around the queen
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      pieces.push({
        x: c + Math.cos(a) * pr * 2.8, y: c + Math.sin(a) * pr * 2.8,
        vx: 0, vy: 0, r: pr, kind: i % 2 === 0 ? "you" : "opp", alive: true,
      });
    }
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const humanTurn = () => phase === "aim" && (turn === 0 || mode === "pnp");
  /** All pieces currently on the board (striker included while it's in play). */
  const movers = () => (striker.alive ? [...pieces.filter((c) => c.alive), striker] : pieces.filter((c) => c.alive));

  function updateHud() {
    hud.set("⚪ You", scoreYou);
    hud.set(oppLbl, scoreOpp);
  }

  function refreshBanner() {
    if (turn === 0) banner.set("Your turn — flick the striker!", "you");
    else banner.set(mode === "bot" ? "🤖 Bot's turn" : "Player 2's turn", "opp");
  }

  // ── Aim & shoot (slingshot: drag back, release to fire the opposite way) ──
  gc.onDown((p) => {
    if (!humanTurn()) return;
    const onStriker = Math.hypot(p.x - striker.x, p.y - striker.y) < sr * 2.4;
    const onBaseline = Math.abs(p.y - baseY(turn)) < sr * 2;
    if (!onStriker && onBaseline) striker.x = clamp(p.x, xMin, xMax); // tap the line → reposition
    if (onStriker || onBaseline) { aiming = true; drag = p; }
  });
  gc.onMove((p) => { if (aiming) drag = p; });
  gc.onUp((p) => {
    if (!aiming) return;
    aiming = false;
    drag = null;
    const dx = striker.x - p.x, dy = striker.y - p.y; // shot vector = opposite the drag
    const len = Math.hypot(dx, dy);
    if (len < 12) return; // tiny pull = it was just a reposition tap
    const power = Math.min(len, MAX_PULL) / MAX_PULL; // 0..1
    striker.vx = (dx / len) * MAX_V * power;
    striker.vy = (dy / len) * MAX_V * power;
    phase = "moving";
    sdk.haptic(25);
  });

  // ── Bot: random baseline spot, aim at nearest own puck (queen 20%), ±8° noise ──
  function scheduleBot() {
    if (mode === "bot" && turn === 1 && phase === "aim") botTimer = window.setTimeout(botShoot, 700);
  }
  function botShoot() {
    if (phase !== "aim" || turn !== 1) return;
    striker.x = xMin + Math.random() * (xMax - xMin);
    striker.y = baseY(1);
    const queen = pieces.find((c) => c.alive && c.kind === "queen");
    let target: Piece | undefined = queen && Math.random() < 0.2 ? queen : undefined;
    if (!target)
      for (const c of pieces) {
        if (!c.alive || c.kind !== "opp") continue;
        if (!target || Math.hypot(c.x - striker.x, c.y - striker.y) < Math.hypot(target.x - striker.x, target.y - striker.y)) target = c;
      }
    if (!target) target = queen;
    if (!target) return;
    const ang = Math.atan2(target.y - striker.y, target.x - striker.x) + ((Math.random() * 16 - 8) * Math.PI) / 180;
    const sp = MAX_V * (0.7 + Math.random() * 0.3);
    striker.vx = Math.cos(ang) * sp;
    striker.vy = Math.sin(ang) * sp;
    phase = "moving";
  }

  // ── Physics: sub-stepped integration + friction + walls + elastic collisions ──
  function physics(dt: number) {
    const SUB = 2, step = dt / SUB; // 2 sub-steps so a fast striker can't tunnel
    // FRICTION is defined per 1/120 s tick; pow() rescales it to the actual
    // sub-step length so drag feels identical at any frame rate.
    const fr = Math.pow(FRICTION, step * 120);
    for (let s = 0; s < SUB; s++) {
      for (const c of movers()) {
        c.x += c.vx * step; c.y += c.vy * step;
        c.vx *= fr; c.vy *= fr;
        if (Math.hypot(c.vx, c.vy) < STOP_EPS) { c.vx = 0; c.vy = 0; }
        // pockets before walls, so a corner-bound piece drops in instead of bouncing
        for (const pt of POCKETS) if (c.alive && Math.hypot(c.x - pt.x, c.y - pt.y) < PR) pocket(c);
        if (!c.alive) continue;
        // walls: reflect only the normal velocity component at 0.8 restitution
        if (c.x < FR + c.r) { c.x = FR + c.r; c.vx = Math.abs(c.vx) * REST; }
        if (c.x > w - FR - c.r) { c.x = w - FR - c.r; c.vx = -Math.abs(c.vx) * REST; }
        if (c.y < FR + c.r) { c.y = FR + c.r; c.vy = Math.abs(c.vy) * REST; }
        if (c.y > w - FR - c.r) { c.y = w - FR - c.r; c.vy = -Math.abs(c.vy) * REST; }
      }
      // Circle-circle collisions. Equal masses + elastic hit → the pair simply
      // SWAPS the velocity component along the collision normal (tangential
      // components are untouched), which is exactly the classic impulse result.
      const live = movers();
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i], b = live[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy), min = a.r + b.r;
          if (d === 0 || d >= min) continue;
          const nx = dx / d, ny = dy / d;   // collision normal a→b
          const push = (min - d) / 2;       // resolve overlap half-and-half
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; // closing speed along n
          if (rel <= 0) continue;           // already separating
          a.vx -= rel * nx; a.vy -= rel * ny;
          b.vx += rel * nx; b.vy += rel * ny;
          if (rel > w * 0.35 && sfxCool <= 0) { sdk.sfx("pop"); sfxCool = 0.07; }
        }
    }
    if (movers().every((c) => c.vx === 0 && c.vy === 0)) resolveTurn();
  }

  function pocket(c: Piece) {
    c.alive = false; c.vx = 0; c.vy = 0;
    sdk.sfx("coin");
    if (c.kind === "you") { scoreYou++; if (turn === 0) pottedOwn = true; }        // teal always scores you
    else if (c.kind === "opp") { scoreOpp++; if (turn === 1) pottedOwn = true; }   // pink always scores them
    else if (c.kind === "queen") { if (turn === 0) scoreYou += 3; else scoreOpp += 3; } // queen: +3 shooter
    else if (turn === 0) scoreYou = Math.max(0, scoreYou - 1); // striker foul: -1 shooter (min 0),
    else scoreOpp = Math.max(0, scoreOpp - 1);                 // striker returns next placement
    updateHud();
  }

  /** All pieces have stopped: score the board or hand the turn over. */
  function resolveTurn() {
    const youLeft = pieces.some((c) => c.alive && c.kind === "you");
    const oppLeft = pieces.some((c) => c.alive && c.kind === "opp");
    if (!youLeft || !oppLeft) return endGame(); // one side's 4 pucks all pocketed
    if (!pottedOwn) turn = turn === 0 ? 1 : 0;  // sank your own colour → shoot again
    pottedOwn = false;
    striker.alive = true; striker.vx = 0; striker.vy = 0;
    striker.x = w / 2; striker.y = baseY(turn);
    phase = "aim";
    refreshBanner();
    scheduleBot();
  }

  function endGame() {
    phase = "over";
    const youWon = scoreYou > scoreOpp;
    const coins = youWon ? sdk.scaleReward(30, 1) : 6;
    if (youWon) sdk.submitScore("carrom", sdk.getBest("carrom") + 1);
    sdk.addCoins(coins, "Carrom Clash");
    banner.set(youWon ? "🏆 Clash won!" : "Board lost", youWon ? "you" : "opp");
    showOverlay(gc.canvas, {
      title: youWon ? "Clash Won! ⚪" : "Lost the Board",
      subtitle: `${scoreYou} – ${scoreOpp}`,
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Rematch",
      onPrimary: reset,
    });
  }

  function reset() {
    buildPieces();
    scoreYou = 0; scoreOpp = 0;
    turn = 0; pottedOwn = false; aiming = false; drag = null;
    striker.alive = true; striker.vx = 0; striker.vy = 0;
    striker.x = w / 2; striker.y = baseY(0);
    phase = "aim";
    updateHud();
    refreshBanner();
  }

  function drawPiece(c: Piece, fill: string, rim: string) {
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = rim; ctx.stroke();
  }

  gc.run((dt) => {
    sfxCool -= dt;
    if (phase === "moving") physics(dt);

    ctx.clearRect(0, 0, w, w);
    roundRect(ctx, 0, 0, w, w, 18, FRAME_COLOR);                      // wooden frame
    roundRect(ctx, FR, FR, w - FR * 2, w - FR * 2, 10, INNER_COLOR);  // playing surface
    // center decoration
    ctx.strokeStyle = "rgba(90,45,20,0.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, w / 2, w * 0.14, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, w / 2, pr * 1.4, 0, 7); ctx.fillStyle = "rgba(150,60,40,0.35)"; ctx.fill();
    // baselines (the active shooter's line glows in their colour)
    for (const s of [0, 1] as const) {
      const col = phase !== "over" && turn === s ? (s === 0 ? palette.teal : palette.pink) : "rgba(90,45,20,0.4)";
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(xMin, baseY(s)); ctx.lineTo(xMax, baseY(s)); ctx.stroke();
      for (const ex of [xMin, xMax]) { ctx.beginPath(); ctx.arc(ex, baseY(s), 5, 0, 7); ctx.fill(); }
    }
    // pockets
    for (const pt of POCKETS) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, PR, 0, 7);
      ctx.fillStyle = "#33200f"; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();
    }
    // pieces + striker
    for (const c of pieces)
      if (c.alive) drawPiece(c, c.kind === "you" ? palette.teal : c.kind === "opp" ? palette.pink : QUEEN_GOLD, "rgba(255,255,255,0.55)");
    if (striker.alive) {
      drawPiece(striker, palette.cream, "rgba(36,31,61,0.45)");
      ctx.beginPath(); ctx.arc(striker.x, striker.y, sr * 0.5, 0, 7);
      ctx.strokeStyle = "rgba(36,31,61,0.3)"; ctx.lineWidth = 2; ctx.stroke();
    }
    // dashed hint ring while a human can grab the striker
    if (humanTurn() && !aiming) {
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(striker.x, striker.y, sr + 6, 0, 7);
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([]);
    }
    // slingshot power arrow — points opposite the drag, length = power
    if (aiming && drag) {
      const dx = striker.x - drag.x, dy = striker.y - drag.y;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        const ux = dx / len, uy = dy / len;
        const cl = Math.min(len, MAX_PULL);
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; // pull-back ghost line
        ctx.beginPath(); ctx.moveTo(striker.x, striker.y); ctx.lineTo(drag.x, drag.y); ctx.stroke();
        const tx = striker.x + ux * cl, ty = striker.y + uy * cl;
        ctx.strokeStyle = palette.marigold; ctx.lineWidth = 5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(striker.x, striker.y); ctx.lineTo(tx, ty);
        const ang = Math.atan2(uy, ux); // arrowhead
        ctx.moveTo(tx, ty); ctx.lineTo(tx - Math.cos(ang - 0.5) * 14, ty - Math.sin(ang - 0.5) * 14);
        ctx.moveTo(tx, ty); ctx.lineTo(tx - Math.cos(ang + 0.5) * 14, ty - Math.sin(ang + 0.5) * 14);
        ctx.stroke();
        ctx.lineCap = "butt";
      }
    }
  });

  buildPieces();
  updateHud();
  refreshBanner();

  return () => {
    window.clearTimeout(botTimer);
    gc.destroy();
  };
}
