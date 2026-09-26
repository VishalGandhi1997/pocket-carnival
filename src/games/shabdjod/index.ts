// Word Ring — word connect. Tap letters arranged in a ring to spell a
// word, submit to check it against the level's word list. Find every
// word to clear the level. Progress persists via best score (legacy saves)
// and the platform level store — whichever is higher wins.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import { shake } from "../../engine/fx";
import type { Sdk } from "../../sdk/platform";

interface LevelData {
  letters: string[];
  words: string[];
}

// 30 hand-made levels in rising tiers. Every word only uses the level's
// letters (each at most once, matching the one-tap-per-letter rule).
//   L1–5   : 5 letters, 3 words
//   L6–10  : 5 letters, 4 words
//   L11–15 : 6 letters, 4 words
//   L16–22 : 6 letters, 5 words
//   L23–30 : 7 letters, 5 words
// Past L30 the hardest tiers (L16–30) repeat, so difficulty never drops back.
const LEVELS: LevelData[] = [
  { letters: ["T", "E", "A", "M", "S"], words: ["TEA", "SEA", "TEAM"] },
  { letters: ["R", "A", "I", "N", "S"], words: ["AIR", "RAN", "RAIN"] },
  { letters: ["H", "O", "U", "S", "E"], words: ["HUE", "USE", "SHOE"] },
  { letters: ["B", "R", "E", "A", "D"], words: ["BED", "EAR", "BREAD"] },
  { letters: ["S", "T", "O", "N", "E"], words: ["TON", "NET", "STONE"] },
  { letters: ["H", "E", "A", "R", "T"], words: ["HAT", "EAR", "HEAT", "HEART"] },
  { letters: ["P", "L", "A", "N", "T"], words: ["PAN", "TAP", "ANT", "PLANT"] },
  { letters: ["C", "L", "O", "U", "D"], words: ["OLD", "COD", "LOUD", "CLOUD"] },
  { letters: ["W", "A", "T", "E", "R"], words: ["TEA", "WET", "RATE", "WATER"] },
  { letters: ["S", "M", "I", "L", "E"], words: ["LIE", "MILE", "LIME", "SMILE"] },
  { letters: ["P", "L", "A", "N", "E", "T"], words: ["PAN", "TAP", "PLAN", "PLANET"] },
  { letters: ["G", "R", "A", "P", "E", "S"], words: ["GAS", "PAGE", "GRAPE", "GRAPES"] },
  { letters: ["F", "L", "O", "W", "E", "R"], words: ["FEW", "LOW", "FLOW", "FLOWER"] },
  { letters: ["M", "O", "N", "K", "E", "Y"], words: ["KEY", "MEN", "MONEY", "MONKEY"] },
  { letters: ["S", "T", "R", "O", "N", "G"], words: ["SON", "TON", "SORT", "STRONG"] },
  { letters: ["G", "A", "R", "D", "E", "N"], words: ["RED", "AGE", "DEAR", "RANGE", "GARDEN"] },
  { letters: ["F", "R", "I", "E", "N", "D"], words: ["FIN", "RED", "FIND", "FRIED", "FRIEND"] },
  { letters: ["S", "I", "L", "V", "E", "R"], words: ["LIE", "LIVE", "RISE", "LIVER", "SILVER"] },
  { letters: ["C", "A", "S", "T", "L", "E"], words: ["CAT", "SEA", "LAST", "LATE", "CASTLE"] },
  { letters: ["W", "I", "N", "T", "E", "R"], words: ["WIN", "TEN", "WIRE", "WRITE", "WINTER"] },
  { letters: ["B", "R", "I", "D", "G", "E"], words: ["BED", "BIG", "BIRD", "BRIDE", "BRIDGE"] },
  { letters: ["M", "A", "R", "K", "E", "T"], words: ["ARM", "TEA", "MAKE", "MARK", "MARKET"] },
  { letters: ["P", "L", "A", "N", "E", "T", "S"], words: ["PAN", "LAST", "PLANE", "PLANT", "PLANETS"] },
  { letters: ["T", "E", "A", "C", "H", "E", "R"], words: ["CAT", "HEAT", "TEACH", "CHEAT", "TEACHER"] },
  { letters: ["R", "A", "I", "N", "B", "O", "W"], words: ["RAN", "BOW", "IRON", "BRAIN", "RAINBOW"] },
  { letters: ["K", "I", "T", "C", "H", "E", "N"], words: ["TIN", "KIT", "THIN", "THICK", "KITCHEN"] },
  { letters: ["F", "R", "E", "E", "D", "O", "M"], words: ["RED", "FREE", "MORE", "FORMED", "FREEDOM"] },
  { letters: ["M", "O", "R", "N", "I", "N", "G"], words: ["RIM", "RING", "IRON", "GRIN", "MORNING"] },
  { letters: ["C", "H", "I", "C", "K", "E", "N"], words: ["INCH", "NICE", "NECK", "CHICK", "CHICKEN"] },
  { letters: ["W", "E", "A", "T", "H", "E", "R"], words: ["HAT", "HEAT", "WHEAT", "THREE", "WEATHER"] },
];
const REPEAT_FROM = 15; // 0-based index of L16

function levelData(level: number): LevelData {
  const i = level - 1;
  if (i < LEVELS.length) return LEVELS[i];
  return LEVELS[REPEAT_FROM + ((i - LEVELS.length) % (LEVELS.length - REPEAT_FROM))];
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mountShabdJod(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Found"]);
  const gc = createGameCanvas(host, 1.25);
  const { ctx } = gc;

  // Best score stores the level you've reached (legacy saves); the platform
  // level store is kept in sync too, so returning players resume either way.
  let level = Math.max(1, sdk.getBest("shabdjod"), sdk.getLevel("shabdjod"));
  let letters: string[] = [];
  let words: string[] = [];
  let found = new Set<string>();
  let current: number[] = []; // indices of tapped (dimmed) letters, in order
  let solved = false;
  let flashT = 0; // seconds left on the "+10" pop above the ring

  function start() {
    level = Math.max(level, sdk.getBest("shabdjod"), sdk.getLevel("shabdjod"));
    const data = levelData(level);
    // Shuffle the ring so the longest word is never spelled out clockwise.
    letters = shuffled(data.letters);
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
    sdk.addCoins(coins, "Word Ring");
    sdk.submitScore("shabdjod", level + 1);
    sdk.setLevel("shabdjod", level + 1);
    const next = levelData(level + 1);
    showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Brilliant! Level ${level + 1} — ${next.letters.length} letters, ${next.words.length} words`,
      coins,
      mood: "win",
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

  // ── Controls (shared .game-controls pattern) ──
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
