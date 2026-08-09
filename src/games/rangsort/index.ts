// Rang Sort — color sort puzzle. Tap a tin to lift its top color, tap
// another to pour. Fill every tin with a single color to win the level.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay, makeBoosterBar } from "../../engine/ui";
import { ECONOMY } from "../../sdk/economy";
import type { Sdk } from "../../sdk/platform";

const CAP = 4;

export function mountRangSort(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Moves"]);
  const gc = createGameCanvas(host, 1.3);
  const { ctx } = gc;

  let level = Math.max(1, sdk.getBest("rangsort"));
  let tubes: string[][] = [];
  let selected = -1;
  let moves = 0;
  let undoStack: string[][][] = [];
  let solved = false;

  function colorCount(lv: number) {
    return Math.min(3 + Math.floor((lv - 1) / 2), 7);
  }

  function deal() {
    const nc = colorCount(level);
    const colors = palette.pieces.slice(0, nc);
    // Deal from a solved state backwards-ish: shuffle all units randomly.
    // Occasional hard/unsolvable deals are escaped via the free Re-deal.
    const units = colors.flatMap((c) => Array(CAP).fill(c) as string[]);
    for (let i = units.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [units[i], units[j]] = [units[j], units[i]];
    }
    tubes = [];
    for (let i = 0; i < nc; i++) tubes.push(units.slice(i * CAP, i * CAP + CAP));
    tubes.push([], []);
    selected = -1;
    moves = 0;
    undoStack = [];
    solved = false;
    hud.set("Level", level);
    hud.set("Moves", 0);
  }

  function layout() {
    const n = tubes.length;
    const cols = Math.ceil(n / 2);
    const tw = Math.min(54, (gc.w - 40) / cols - 12);
    const th = tw * 2.6;
    const rows: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const row = i < cols ? 0 : 1;
      const inRow = row === 0 ? cols : n - cols;
      const idx = row === 0 ? i : i - cols;
      const totalW = inRow * (tw + 12) - 12;
      rows.push({
        x: (gc.w - totalW) / 2 + idx * (tw + 12),
        y: 40 + row * (th + 46),
      });
    }
    return { tw, th, pos: rows };
  }

  function pour(from: number, to: number): boolean {
    const src = tubes[from], dst = tubes[to];
    if (!src.length || dst.length >= CAP) return false;
    const color = src[src.length - 1];
    if (dst.length && dst[dst.length - 1] !== color) return false;
    undoStack.push(tubes.map((t) => [...t]));
    while (src.length && src[src.length - 1] === color && dst.length < CAP)
      dst.push(src.pop()!);
    moves++;
    hud.set("Moves", moves);
    sdk.haptic();
    if (tubes.every((t) => !t.length || (t.length === CAP && t.every((c) => c === t[0]))))
      win();
    return true;
  }

  function win() {
    solved = true;
    const coins = 5 + colorCount(level) * 2;
    sdk.addCoins(coins, "Rang Sort");
    level++;
    sdk.submitScore("rangsort", level);
    showOverlay(gc.canvas, {
      title: "Sorted! 🌈",
      subtitle: `Level ${level - 1} done in ${moves} moves`,
      coins,
      primaryLabel: `Level ${level} ›`,
      onPrimary: deal,
    });
  }

  gc.onDown((p) => {
    if (solved) return;
    const { tw, th, pos } = layout();
    const hit = pos.findIndex(
      (t) => p.x >= t.x - 8 && p.x <= t.x + tw + 8 && p.y >= t.y - 26 && p.y <= t.y + th + 8,
    );
    if (hit < 0) {
      selected = -1;
      return;
    }
    if (selected === -1) {
      if (tubes[hit].length) selected = hit;
    } else if (hit === selected) {
      selected = -1;
    } else {
      pour(selected, hit);
      selected = -1;
    }
  });

  gc.run(() => {
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const { tw, th, pos } = layout();
    const unit = (th - 8) / CAP;
    tubes.forEach((tube, i) => {
      const { x, y } = pos[i];
      const lift = i === selected ? -14 : 0;
      roundRect(ctx, x - 3, y + lift - 3, tw + 6, th + 6, 12, "rgba(255,248,236,0.16)");
      roundRect(ctx, x, y + lift, tw, th, 9, palette.board);
      tube.forEach((c, j) => {
        const isTop = j === tube.length - 1;
        const raise = i === selected && isTop ? -10 : 0;
        roundRect(ctx, x + 4, y + lift + raise + th - 4 - (j + 1) * unit + 2, tw - 8, unit - 4, 6, c);
      });
    });
  });

  // controls
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const undoBtn = document.createElement("button");
  undoBtn.className = "btn-ghost";
  undoBtn.textContent = "↩ Undo";
  undoBtn.addEventListener("click", () => {
    const prev = undoStack.pop();
    if (prev && !solved) {
      tubes = prev;
      moves++;
      hud.set("Moves", moves);
    }
  });
  const redealBtn = document.createElement("button");
  redealBtn.className = "btn-ghost";
  redealBtn.textContent = "🔀 Re-deal";
  redealBtn.addEventListener("click", () => !solved && deal());
  controls.append(undoBtn, redealBtn);
  host.appendChild(controls);

  // Booster — an extra empty tube gives you room to untangle a stuck level.
  makeBoosterBar(host, [
    {
      icon: "🧪", label: "+1 Tube", cost: ECONOMY.boosters.extraTube,
      onUse: () => {
        if (!solved) tubes.push([]);
      },
    },
  ]);

  deal();
  return () => gc.destroy();
}
