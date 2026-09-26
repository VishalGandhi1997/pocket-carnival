// Box Claim — dots & boxes. Tap between two dots to draw a line;
// complete a box's fourth side to claim it (and go again).
// Bot mode has a persistent level ladder: the bot stops blundering, the grid
// grows to 5×5 boxes at Level 3, and from Level 4 it sacrifices only the
// shortest chains. Beat the bot to level up.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, makeTurnBanner, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

type Owner = 0 | 1 | 2;
type Edge = { kind: "h" | "v"; r: number; c: number };

// ── Level curve (bot mode) ──
const gridBoxes = (level: number) => (level >= 3 ? 5 : 4); // boxes per side
const botBlunderChance = (level: number) => (level <= 1 ? 0.35 : 0);
const botChainAware = (level: number) => level >= 4;
function levelUpLabel(level: number): string {
  if (level === 2) return "the bot stops handing out free boxes";
  if (level === 3) return "bigger 5×5 grid";
  if (level === 4) return "the bot now gives away only its shortest chains";
  return "5×5 grid, chain-savvy bot";
}

export function mountKataKat(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  // Level ladder only applies vs the bot; pass & play stays a friendly 4×4 match.
  let level = mode === "bot" ? sdk.getLevel("katakat") : 1;
  let BOXES = 4;
  let DOTS = BOXES + 1;
  const hud = makeHud(host, mode === "bot" ? ["Level", "You", "Bot"] : ["You", "P2"]);
  const banner = makeTurnBanner(host);
  const gc = createGameCanvas(host, 1.05);
  const { ctx } = gc;

  let h: Owner[][] = [];
  let v: Owner[][] = [];
  let boxOwner: Owner[][] = [];
  let turn: 1 | 2 = 1;
  let over = false;

  function reset() {
    if (mode === "bot") {
      level = sdk.getLevel("katakat");
      hud.set("Level", level);
    }
    BOXES = mode === "bot" ? gridBoxes(level) : 4;
    DOTS = BOXES + 1;
    h = Array.from({ length: DOTS }, () => Array(BOXES).fill(0) as Owner[]);
    v = Array.from({ length: BOXES }, () => Array(DOTS).fill(0) as Owner[]);
    boxOwner = Array.from({ length: BOXES }, () => Array(BOXES).fill(0) as Owner[]);
    turn = 1;
    over = false;
    hud.set("You", 0);
    hud.set(mode === "bot" ? "Bot" : "P2", 0);
    refreshBanner();
  }

  function refreshBanner() {
    if (over) return;
    if (turn === 1) banner.set("Your turn — draw a line", "you");
    else banner.set(mode === "bot" ? `🤖 Bot (Lv ${level}) is thinking…` : "Player 2's turn", "opp");
  }

  function boxSides(br: number, bc: number) {
    return [h[br][bc], h[br + 1][bc], v[br][bc], v[br][bc + 1]];
  }

  function boxesForHEdge(r: number, c: number): [number, number][] {
    const out: [number, number][] = [];
    if (r - 1 >= 0) out.push([r - 1, c]);
    if (r < BOXES) out.push([r, c]);
    return out;
  }
  function boxesForVEdge(r: number, c: number): [number, number][] {
    const out: [number, number][] = [];
    if (c - 1 >= 0) out.push([r, c - 1]);
    if (c < BOXES) out.push([r, c]);
    return out;
  }

  function placeEdge(kind: "h" | "v", r: number, c: number, player: 1 | 2): number {
    if (kind === "h") h[r][c] = player;
    else v[r][c] = player;
    const boxes = kind === "h" ? boxesForHEdge(r, c) : boxesForVEdge(r, c);
    let claimed = 0;
    for (const [br, bc] of boxes) {
      if (boxOwner[br][bc] === 0 && boxSides(br, bc).every((s) => s !== 0)) {
        boxOwner[br][bc] = player;
        claimed++;
      }
    }
    return claimed;
  }

  function totalBoxes(player: Owner) {
    return boxOwner.flat().filter((o) => o === player).length;
  }

  function isDone() {
    return boxOwner.flat().every((o) => o !== 0);
  }

  function afterMove(player: 1 | 2, claimed: number) {
    hud.set("You", totalBoxes(1));
    hud.set(mode === "bot" ? "Bot" : "P2", totalBoxes(2));
    sdk.haptic(claimed ? 30 : 12);
    if (isDone()) return endGame();
    if (claimed === 0) turn = player === 1 ? 2 : 1;
    refreshBanner();
    if (mode === "bot" && turn === 2 && !over) setTimeout(botMove, 500);
  }

  function endGame() {
    over = true;
    const you = totalBoxes(1), opp = totalBoxes(2);
    const youWon = you > opp;
    const leveledUp = mode === "bot" && youWon;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("katakat", level);
      hud.set("Level", level);
    }
    const coins = sdk.scaleReward(youWon ? 28 : you === opp ? 10 : 6, level);
    if (youWon) sdk.submitScore("katakat", sdk.getBest("katakat") + 1);
    sdk.addCoins(coins, "Box Claim");
    let subtitle = `${you} – ${opp} boxes`;
    if (leveledUp) subtitle = `${you} – ${opp} boxes · Level ${level} — ${levelUpLabel(level)}`;
    else if (mode === "bot") subtitle = `${you} – ${opp} boxes · beat the Lv ${level} bot to reach Level ${level + 1}`;
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : youWon ? "You Won! 🏆" : you === opp ? "It's a Tie" : "You Lost",
      subtitle,
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function allEdges(): Edge[] {
    const out: Edge[] = [];
    for (let r = 0; r < DOTS; r++) for (let c = 0; c < BOXES; c++) if (h[r][c] === 0) out.push({ kind: "h", r, c });
    for (let r = 0; r < BOXES; r++) for (let c = 0; c < DOTS; c++) if (v[r][c] === 0) out.push({ kind: "v", r, c });
    return out;
  }

  function wouldGiveThirdSide(kind: "h" | "v", r: number, c: number): boolean {
    const boxes = kind === "h" ? boxesForHEdge(r, c) : boxesForVEdge(r, c);
    for (const [br, bc] of boxes) {
      const sides = boxSides(br, bc).filter((s) => s !== 0).length;
      if (sides === 2) return true; // placing this edge makes it 3 → opponent completes next
    }
    return false;
  }

  /** Boxes the opponent could chain-capture right after this edge is drawn. */
  function giveawayIfPlayed(e: Edge): number {
    const hs = h.map((row) => [...row]);
    const vs = v.map((row) => [...row]);
    if (e.kind === "h") hs[e.r][e.c] = 2;
    else vs[e.r][e.c] = 2;
    let taken = 0;
    for (let found = true; found; ) {
      found = false;
      for (let br = 0; br < BOXES; br++)
        for (let bc = 0; bc < BOXES; bc++) {
          const sides = [hs[br][bc], hs[br + 1][bc], vs[br][bc], vs[br][bc + 1]];
          if (sides.filter((x) => x !== 0).length !== 3) continue;
          // opponent completes this box, which may open the next one in the chain
          if (!hs[br][bc]) hs[br][bc] = 1;
          else if (!hs[br + 1][bc]) hs[br + 1][bc] = 1;
          else if (!vs[br][bc]) vs[br][bc] = 1;
          else vs[br][bc + 1] = 1;
          taken++;
          found = true;
        }
    }
    return taken;
  }

  function botMove() {
    if (over) return;
    const edges = allEdges();
    if (!edges.length) return;
    // L1: sometimes just scribbles anywhere (even handing over boxes)
    if (Math.random() < botBlunderChance(level)) {
      const e = edges[Math.floor(Math.random() * edges.length)];
      return applyEdge(e.kind, e.r, e.c, 2);
    }
    let best: (Edge & { gain: number }) | null = null;
    for (const e of edges) {
      const boxes = e.kind === "h" ? boxesForHEdge(e.r, e.c) : boxesForVEdge(e.r, e.c);
      const gain = boxes.filter(([br, bc]) => boxSides(br, bc).filter((s) => s !== 0).length === 3).length;
      if (gain > 0 && (!best || gain > best.gain)) best = { ...e, gain };
    }
    if (best) return applyEdge(best.kind, best.r, best.c, 2);
    const safe = edges.filter((e) => !wouldGiveThirdSide(e.kind, e.r, e.c));
    if (!safe.length && botChainAware(level)) {
      // L4+: forced to open something — sacrifice the shortest chain
      let pick = edges[0];
      let least = Infinity;
      for (const e of edges) {
        const n = giveawayIfPlayed(e) + Math.random() * 0.1; // jitter breaks ties
        if (n < least) {
          least = n;
          pick = e;
        }
      }
      return applyEdge(pick.kind, pick.r, pick.c, 2);
    }
    const pick = (safe.length ? safe : edges)[Math.floor(Math.random() * (safe.length ? safe.length : edges.length))];
    applyEdge(pick.kind, pick.r, pick.c, 2);
  }

  function applyEdge(kind: "h" | "v", r: number, c: number, player: 1 | 2) {
    const claimed = placeEdge(kind, r, c, player);
    afterMove(player, claimed);
  }

  gc.onDown((p) => {
    if (over) return;
    if (mode === "bot" && turn !== 1) return;
    const { pad, cell } = layout();
    let bestKind: "h" | "v" | null = null;
    let bestR = 0, bestC = 0, bestDist = Infinity;
    for (let r = 0; r < DOTS; r++)
      for (let c = 0; c < BOXES; c++) {
        if (h[r][c] !== 0) continue;
        const mx = pad + (c + 0.5) * cell, my = pad + r * cell;
        if (Math.abs(p.x - mx) < cell * 0.42 && Math.abs(p.y - my) < cell * 0.28) {
          const d = Math.hypot(p.x - mx, p.y - my);
          if (d < bestDist) { bestDist = d; bestKind = "h"; bestR = r; bestC = c; }
        }
      }
    for (let r = 0; r < BOXES; r++)
      for (let c = 0; c < DOTS; c++) {
        if (v[r][c] !== 0) continue;
        const mx = pad + c * cell, my = pad + (r + 0.5) * cell;
        if (Math.abs(p.x - mx) < cell * 0.28 && Math.abs(p.y - my) < cell * 0.42) {
          const d = Math.hypot(p.x - mx, p.y - my);
          if (d < bestDist) { bestDist = d; bestKind = "v"; bestR = r; bestC = c; }
        }
      }
    if (bestKind) applyEdge(bestKind, bestR, bestC, turn);
  });

  function layout() {
    const pad = 24;
    const cell = (gc.w - pad * 2) / BOXES;
    return { pad, cell };
  }

  gc.run(() => {
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const { pad, cell } = layout();

    // boxes
    for (let r = 0; r < BOXES; r++)
      for (let c = 0; c < BOXES; c++) {
        const owner = boxOwner[r][c];
        if (owner) roundRect(ctx, pad + c * cell + 6, pad + r * cell + 6, cell - 12, cell - 12, 6,
          owner === 1 ? "rgba(6,214,160,0.28)" : "rgba(239,71,111,0.28)");
      }

    // edges
    ctx.lineCap = "round";
    for (let r = 0; r < DOTS; r++)
      for (let c = 0; c < BOXES; c++) {
        if (!h[r][c]) continue;
        ctx.strokeStyle = h[r][c] === 1 ? palette.teal : palette.pink;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(pad + c * cell, pad + r * cell);
        ctx.lineTo(pad + (c + 1) * cell, pad + r * cell);
        ctx.stroke();
      }
    for (let r = 0; r < BOXES; r++)
      for (let c = 0; c < DOTS; c++) {
        if (!v[r][c]) continue;
        ctx.strokeStyle = v[r][c] === 1 ? palette.teal : palette.pink;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(pad + c * cell, pad + r * cell);
        ctx.lineTo(pad + c * cell, pad + (r + 1) * cell);
        ctx.stroke();
      }

    // dots
    for (let r = 0; r < DOTS; r++)
      for (let c = 0; c < DOTS; c++) {
        ctx.beginPath();
        ctx.arc(pad + c * cell, pad + r * cell, 5, 0, 7);
        ctx.fillStyle = palette.cream;
        ctx.fill();
      }
  });

  reset();
  return () => gc.destroy();
}
