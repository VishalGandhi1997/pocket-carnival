// Shabd Jod — word connect. Tap letters arranged in a ring to spell a
// word, submit to check it against the level's word list. Find every
// word to clear the level; levels persist via best score like Rang Sort.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import { shake } from "../../engine/fx";
import type { Sdk } from "../../sdk/platform";

interface LevelData {
  letters: string[];
  words: string[];
}

// 10 hand-made levels. Every word only uses the level's letters (each at
// most once, matching the one-tap-per-letter rule).
const LEVELS: LevelData[] = [
  { letters: ["T", "E", "A", "M", "S"], words: ["TEA", "SEA", "MAT", "EAST", "MATES"] },
  { letters: ["R", "A", "I", "N", "S"], words: ["RAN", "SIR", "AIR", "RAIN", "RAINS"] },
  { letters: ["H", "O", "U", "S", "E"], words: ["HUE", "USE", "SHOE", "HOUSE"] },
  { letters: ["B", "R", "E", "A", "D"], words: ["BED", "EAR", "READ", "BEAR", "BREAD"] },
  { letters: ["S", "T", "O", "N", "E"], words: ["TON", "NET", "NOSE", "NOTE", "STONE"] },
  { letters: ["P", "L", "A", "N", "E", "T"], words: ["PAN", "TAP", "PLAN", "PLANE", "PLANET"] },
  { letters: ["G", "R", "A", "P", "E", "S"], words: ["GAS", "RAGE", "PAGE", "GRAPE", "GRAPES"] },
  { letters: ["C", "L", "O", "U", "D", "S"], words: ["OLD", "LOUD", "SOUL", "CLOUD", "CLOUDS"] },
  { letters: ["F", "L", "O", "W", "E", "R"], words: ["FEW", "LOW", "WORE", "FLOW", "FLOWER"] },
  { letters: ["M", "O", "N", "K", "E", "Y"], words: ["ONE", "KEY", "MEN", "MONEY", "MONKEY"] },
];

export function mountShabdJod(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Found"]);
  const gc = createGameCanvas(host, 1.25);
  const { ctx } = gc;

  // Same persistence pattern as Rang Sort: best score stores the level
  // you've reached, so returning players resume where they left off.
  let level = Math.max(1, sdk.getBest("shabdjod"));
  let letters: string[] = [];
  let words: string[] = [];
  let found = new Set<string>();
  let current: number[] = []; // indices of tapped (dimmed) letters, in order
  let solved = false;
  let flashT = 0; // seconds left on the "+10" pop above the ring

  function start() {
    const data = LEVELS[(level - 1) % LEVELS.length];
    letters = [...data.letters];
    words = [...data.words];
    found = new Set();
    current = [];
    solved = false;
    flashT = 0;
    hud.set("Level", level);
    hud.set("Found", `0/${words.length}`);
  }

  function ringPos() {
    const cx = gc.w / 2;
    const cy = gc.h * 0.42;
    const R = gc.w * 0.245;
    return letters.map((_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / letters.length;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });
  }

  function clearAttempt() {
    current = [];
  }

  function submit() {
    if (solved || !current.length) return;
    const word = current.map((i) => letters[i]).join("");
    if (words.includes(word) && !found.has(word)) {
      found.add(word);
      flashT = 0.9; // "+10" score pop
      sdk.sfx("clear");
      sdk.haptic(30);
      hud.set("Found", `${found.size}/${words.length}`);
      clearAttempt();
      if (found.size === words.length) win();
    } else {
      sdk.sfx("pop");
      shake(gc.canvas);
      clearAttempt();
    }
  }

  function win() {
    solved = true;
    const coins = sdk.scaleReward(8, level);
    sdk.addCoins(coins, "Shabd Jod");
    sdk.submitScore("shabdjod", level + 1);
    showOverlay(gc.canvas, {
      title: "Shabash! 🔤",
      subtitle: `Level ${level} clear`,
      coins,
      primaryLabel: `Level ${level + 1} ›`,
      onPrimary: () => {
        level++;
        start();
      },
    });
  }

  gc.onDown((p) => {
    if (solved) return;
    const r = gc.w * 0.084;
    const pos = ringPos();
    for (let i = 0; i < pos.length; i++) {
      const dx = p.x - pos[i].x;
      const dy = p.y - pos[i].y;
      if (dx * dx + dy * dy <= r * r * 1.8 && !current.includes(i)) {
        current.push(i);
        sdk.haptic();
        return;
      }
    }
  });

  gc.run((dt) => {
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // ── Current word, large above the ring ──
    const pw = gc.w * 0.72;
    const ph = gc.h * 0.078;
    roundRect(ctx, (gc.w - pw) / 2, gc.h * 0.05, pw, ph, 14, palette.board);
    const word = current.map((i) => letters[i]).join("");
    if (word) {
      ctx.font = `800 ${gc.w * 0.072}px "Baloo 2", sans-serif`;
      ctx.fillStyle = palette.marigold;
      ctx.fillText(word.split("").join(" "), gc.w / 2, gc.h * 0.05 + ph / 2 + 1);
    } else {
      ctx.font = `600 ${gc.w * 0.042}px "Baloo 2", sans-serif`;
      ctx.fillStyle = "rgba(255,248,236,0.45)";
      ctx.fillText("Tap letters to spell…", gc.w / 2, gc.h * 0.05 + ph / 2 + 1);
    }
    // "+10" pop after a correct word
    if (flashT > 0) {
      ctx.globalAlpha = Math.min(1, flashT / 0.4);
      ctx.font = `800 ${gc.w * 0.055}px "Baloo 2", sans-serif`;
      ctx.fillStyle = palette.teal;
      ctx.fillText("+10", gc.w * 0.87, gc.h * (0.09 + (0.9 - flashT) * 0.04));
      ctx.globalAlpha = 1;
    }

    // ── Letter ring ──
    const pos = ringPos();
    const r = gc.w * 0.084;
    ctx.beginPath();
    ctx.arc(gc.w / 2, gc.h * 0.42, gc.w * 0.245, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,248,236,0.12)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = `800 ${r * 1.05}px "Baloo 2", sans-serif`;
    pos.forEach((c, i) => {
      const used = current.includes(i);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = used ? "rgba(255,248,236,0.14)" : palette.cream;
      ctx.fill();
      ctx.fillStyle = used ? "rgba(255,248,236,0.35)" : palette.ink;
      ctx.fillText(letters[i], c.x, c.y + 2);
    });

    // ── Word slots under the ring ──
    const y0 = gc.h * 0.7;
    const rowH = Math.min(gc.h * 0.056, (gc.h - 18 - y0) / words.length);
    ctx.font = `700 ${gc.w * 0.046}px "Baloo 2", sans-serif`;
    words.forEach((w, i) => {
      const y = y0 + rowH * (i + 0.5);
      if (found.has(w)) {
        ctx.fillStyle = palette.teal;
        ctx.fillText(w.split("").join(" "), gc.w / 2, y);
      } else {
        ctx.fillStyle = "rgba(255,248,236,0.5)";
        ctx.fillText(w.split("").map(() => "_").join(" "), gc.w / 2, y);
      }
    });
  });

  // ── Controls (same .game-controls pattern as Rang Sort) ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const submitBtn = document.createElement("button");
  submitBtn.className = "btn-ghost";
  submitBtn.textContent = "✓ Submit";
  submitBtn.addEventListener("click", submit);
  const clearBtn = document.createElement("button");
  clearBtn.className = "btn-ghost";
  clearBtn.textContent = "✕ Clear";
  clearBtn.addEventListener("click", () => {
    if (!solved) clearAttempt();
  });
  controls.append(submitBtn, clearBtn);
  host.appendChild(controls);

  start();
  return () => gc.destroy();
}
