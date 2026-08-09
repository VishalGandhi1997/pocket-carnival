// Word Khoj — word search. Press a letter and drag a straight line (row,
// column, or 45° diagonal) to circle a hidden word. Words read forward or
// backward. Find all six — faster hunts score higher.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const N = 9; // 9×9 letter grid
const WORDS_PER_ROUND = 6;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Original pool of simple words (4-7 letters); 6 are hidden each round.
const POOL = [
  "MANGO", "CRICKET", "BAZAAR", "KITE", "TIGER", "LOTUS",
  "CHAI", "TRAIN", "RIVER", "TEMPLE", "PEACOCK", "JUNGLE",
  "MASALA", "SITAR", "LADDU", "DIWALI", "HENNA", "COBRA",
  "SPICE", "CAMEL", "PALACE", "GARDEN", "MONSOON", "BANYAN",
];

// Placement directions: right, down, diag-down-right, diag-up-right.
const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];

interface Target {
  word: string;
  found: boolean;
  color: string; // tint applied to its cells once found
}

interface Cell {
  x: number;
  y: number;
}

export function mountWordKhoj(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Found", "Time"]);
  const gc = createGameCanvas(host, 1.35); // grid on top, word list below
  const { ctx } = gc;

  const pad = 10;
  const size = (gc.w - pad * 2) / N;
  const gridTop = pad;
  const listTop = gridTop + N * size + 12;
  const listFont = Math.round(Math.max(13, gc.w * 0.035));

  let letters: string[][] = [];
  let tint: (string | null)[][] = []; // permanent cell colour once found
  let targets: Target[] = [];
  let selStart: Cell | null = null;
  let selEnd: Cell | null = null;
  let score = 0;
  let elapsed = 0; // whole seconds, advanced by the rAF loop
  let elapsedRaw = 0; // fractional accumulator
  let over = false;

  // ── Puzzle generation ──

  // Try to place one word; crossings are allowed when letters match.
  // Returns false when no spot fits after many random attempts.
  function placeWord(word: string): boolean {
    for (let attempt = 0; attempt < 80; attempt++) {
      const [dx, dy] = DIRS[Math.floor(Math.random() * DIRS.length)];
      const len = word.length;
      const maxX = dx !== 0 ? N - len : N - 1;
      const minY = dy < 0 ? len - 1 : 0;
      const maxY = dy > 0 ? N - len : N - 1;
      const x0 = Math.floor(Math.random() * (maxX + 1));
      const y0 = minY + Math.floor(Math.random() * (maxY - minY + 1));
      let ok = true;
      for (let i = 0; i < len; i++) {
        const cur = letters[y0 + dy * i][x0 + dx * i];
        if (cur !== "" && cur !== word[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let i = 0; i < len; i++) letters[y0 + dy * i][x0 + dx * i] = word[i];
      return true;
    }
    return false;
  }

  function reset() {
    // Pick 6 distinct words, then lay out a grid. If any word can't be
    // placed (rare), throw the grid away and regenerate from scratch.
    for (;;) {
      const words = [...POOL].sort(() => Math.random() - 0.5).slice(0, WORDS_PER_ROUND);
      letters = Array.from({ length: N }, () => Array(N).fill("") as string[]);
      if (words.every(placeWord)) {
        targets = words.map((w, i) => ({
          word: w,
          found: false,
          color: palette.pieces[i % palette.pieces.length],
        }));
        break;
      }
    }
    // Fill the gaps with random letters.
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (letters[y][x] === "") letters[y][x] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    tint = Array.from({ length: N }, () => Array(N).fill(null) as (string | null)[]);
    selStart = null;
    selEnd = null;
    score = 0;
    elapsed = 0;
    elapsedRaw = 0;
    over = false;
    hud.set("Found", `0/${WORDS_PER_ROUND}`);
    hud.set("Time", 0);
  }

  // ── Selection ──

  function cellAt(px: number, py: number): Cell | null {
    const x = Math.floor((px - pad) / size);
    const y = Math.floor((py - gridTop) / size);
    return x >= 0 && x < N && y >= 0 && y < N ? { x, y } : null;
  }

  // Cells along the straight line start→end; when the drag isn't a row,
  // column, or 45° diagonal, only the start cell is highlighted.
  function lineCells(): Cell[] {
    if (!selStart) return [];
    if (!selEnd) return [selStart];
    const dx = selEnd.x - selStart.x;
    const dy = selEnd.y - selStart.y;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return [selStart];
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    const out: Cell[] = [];
    for (let i = 0; i <= steps; i++) out.push({ x: selStart.x + sx * i, y: selStart.y + sy * i });
    return out;
  }

  gc.onDown((p) => {
    if (over) return;
    const c = cellAt(p.x, p.y);
    if (c) {
      selStart = c;
      selEnd = c;
      sdk.haptic();
    }
  });

  gc.onMove((p) => {
    if (over || !selStart) return;
    const c = cellAt(p.x, p.y);
    if (c && (!selEnd || c.x !== selEnd.x || c.y !== selEnd.y)) selEnd = c;
  });

  gc.onUp(() => {
    if (over || !selStart) return;
    const cells = lineCells();
    const s = cells.map((c) => letters[c.y][c.x]).join("");
    const rev = [...s].reverse().join("");
    const hit = targets.find((t) => !t.found && (t.word === s || t.word === rev));
    if (hit) {
      hit.found = true;
      for (const c of cells) tint[c.y][c.x] = hit.color;
      score += 20;
      sdk.sfx("clear");
      sdk.haptic(30);
      const found = targets.filter((t) => t.found).length;
      hud.set("Found", `${found}/${WORDS_PER_ROUND}`);
      if (found === WORDS_PER_ROUND) win();
    }
    selStart = null;
    selEnd = null;
  });

  function win() {
    over = true;
    score += Math.max(0, 200 - elapsed); // faster hunt = bigger bonus
    const isBest = sdk.submitScore("wordkhoj", score);
    const coins = sdk.scaleReward(Math.max(2, Math.floor(score / 20)), 1);
    sdk.addCoins(coins, "Word Khoj");
    showOverlay(gc.canvas, {
      title: "Sab Mil Gaye! 🔎",
      subtitle: `${elapsed}s`,
      coins,
      isBest,
      primaryLabel: "New Puzzle",
      onPrimary: reset,
    });
  }

  // ── Render ──

  gc.run((dt) => {
    if (!over) {
      elapsedRaw += dt;
      if (elapsedRaw >= 1) {
        elapsed += Math.floor(elapsedRaw);
        elapsedRaw -= Math.floor(elapsedRaw);
        hud.set("Time", elapsed);
      }
    }

    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);

    const sel = selStart && !over ? lineCells() : [];
    const inSel = (x: number, y: number) => sel.some((c) => c.x === x && c.y === y);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const cx = pad + x * size;
        const cy = gridTop + y * size;
        const inset = 1.5;
        const t = tint[y][x];
        roundRect(ctx, cx + inset, cy + inset, size - inset * 2, size - inset * 2, 5, t ?? palette.board);
        if (inSel(x, y))
          roundRect(ctx, cx + inset, cy + inset, size - inset * 2, size - inset * 2, 5, "rgba(255,248,236,0.35)");
        ctx.font = `bold ${size * 0.52}px system-ui`;
        ctx.fillStyle = t ? palette.ink : palette.cream;
        ctx.fillText(letters[y][x], cx + size / 2, cy + size / 2 + 1);
      }
    }

    // ── Word list: 2 columns × 3 rows under the grid ──
    const cols = 2;
    const rows = Math.ceil(targets.length / cols);
    const colW = (gc.w - pad * 2) / cols;
    const rowH = (gc.h - listTop - pad) / rows;
    ctx.font = `bold ${listFont}px system-ui`;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const tx = pad + (i % cols) * colW + colW / 2;
      const ty = listTop + Math.floor(i / cols) * rowH + rowH / 2;
      ctx.fillStyle = t.found ? t.color : palette.cream;
      ctx.fillText(t.word, tx, ty);
      if (t.found) {
        // Strikethrough in the word's tint colour.
        const w = ctx.measureText(t.word).width;
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx - w / 2 - 3, ty);
        ctx.lineTo(tx + w / 2 + 3, ty);
        ctx.stroke();
      }
    }
  });

  reset();
  return () => gc.destroy();
}
