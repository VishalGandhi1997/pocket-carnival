// Math Rush — rapid mental-math rush. A sum flashes up big on the canvas,
// four answers wait below; tap the right one before the time bar drains.
// Streaks pay a growing bonus, and three misses end the run.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const LIVES = 3;
const timePerQ = (level: number) => Math.max(3.5, 8 - level * 0.5);
const levelUpAt = (level: number) => 120 + level * 40;
const ri = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

interface Question {
  text: string;
  answer: number;
  options: number[]; // 4 shuffled choices, answer included
}

/** Three distinct, plausible wrong answers near the truth (all ≥ 0). */
function distractors(ans: number): number[] {
  const seen = new Set<number>([ans]);
  const out: number[] = [];
  const tryAdd = (n: number) => {
    if (n >= 0 && !seen.has(n)) { seen.add(n); out.push(n); }
  };
  const transposed = () => {
    const s = String(ans).split("");
    if (s.length < 2) return ans + ri(2, 9);
    const i = ri(0, s.length - 2);
    [s[i], s[i + 1]] = [s[i + 1], s[i]];
    return parseInt(s.join(""), 10);
  };
  for (let guard = 0; out.length < 3 && guard < 50; guard++) {
    const roll = Math.random();
    tryAdd(roll < 0.4 ? ans + ri(1, 10) : roll < 0.8 ? ans - ri(1, 10) : transposed());
  }
  for (let k = 1; out.length < 3; k++) tryAdd(ans + 10 + k); // safety net
  return out;
}

/** Question generator — the pool of shapes widens as the level climbs. */
function makeQuestion(level: number): Question {
  const hi = 20 + Math.min(level, 12) * 10; // operand range caps at 140
  const gens: (() => { text: string; answer: number })[] = [
    () => { const a = ri(2, hi), b = ri(2, hi); return { text: `${a} + ${b}`, answer: a + b }; },
    () => {
      let a = ri(2, hi), b = ri(2, hi);
      if (b > a) [a, b] = [b, a]; // keep results ≥ 0
      return { text: `${a} - ${b}`, answer: a - b };
    },
  ];
  if (level >= 3)
    gens.push(() => { const a = ri(2, 12), b = ri(2, 12); return { text: `${a} × ${b}`, answer: a * b }; });
  if (level >= 5)
    gens.push(() => {
      const a = ri(3, 9), b = ri(3, 9), c = ri(2, 15);
      return a * b > c && Math.random() < 0.5
        ? { text: `${a} × ${b} - ${c}`, answer: a * b - c }
        : { text: `${a} × ${b} + ${c}`, answer: a * b + c };
    });
  if (level >= 7) {
    gens.push(() => { const a = ri(13, 19), b = ri(2, 9); return { text: `${a} × ${b}`, answer: a * b }; });
    gens.push(() => {
      const a = ri(5, hi), b = ri(5, hi), c = ri(5, hi);
      return { text: `${a} + ${b} + ${c}`, answer: a + b + c };
    });
  }
  const base = gens[ri(0, gens.length - 1)]();
  const options = [base.answer, ...distractors(base.answer)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { text: base.text, answer: base.answer, options };
}

export function mountHisab(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Score", "Streak"]);
  const gc = createGameCanvas(host, 0.85); // short canvas — answers live below it
  const { ctx } = gc;

  let level = sdk.getLevel("hisab");
  let q: Question = makeQuestion(level);
  let score = 0, streak = 0, lives = LIVES;
  let timeMax = timePerQ(level), timeLeft = timeMax;
  let locked = false; // answer feedback in progress — blocks double-taps
  let over = false, leveledUp = false;
  let pendingT = 0;

  // ── Four answer buttons below the canvas ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  const btns: HTMLButtonElement[] = [];
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button");
    b.className = "btn-ghost";
    b.addEventListener("click", () => choose(i));
    btns.push(b);
    controls.appendChild(b);
  }
  host.appendChild(controls);

  const paintBtn = (b: HTMLButtonElement, col: string) => {
    b.style.cssText = `background:${col};border-color:${col};color:${palette.ink}`;
  };

  function nextQuestion() {
    q = makeQuestion(level);
    timeMax = timePerQ(level);
    timeLeft = timeMax;
    locked = false;
    btns.forEach((b, i) => {
      b.textContent = String(q.options[i]); b.disabled = false; b.style.cssText = "";
    });
  }

  function lockButtons() {
    locked = true;
    btns.forEach((b) => (b.disabled = true));
  }

  function correct(i: number) {
    lockButtons();
    streak += 1;
    score += 10 + streak * 2; // +10, plus +2 per current streak
    hud.set("Score", score); hud.set("Streak", streak);
    sdk.sfx("coin"); sdk.haptic();
    paintBtn(btns[i], palette.teal);
    while (score >= levelUpAt(level)) { // harder sums + shorter clock from the next question
      level += 1;
      sdk.setLevel("hisab", level);
      leveledUp = true;
      hud.set("Level", level);
    }
    pendingT = window.setTimeout(nextQuestion, 360);
  }

  function miss(chosen: number) {
    lockButtons();
    lives -= 1; streak = 0; hud.set("Streak", 0);
    sdk.sfx("pop"); sdk.haptic(40);
    if (chosen >= 0) paintBtn(btns[chosen], palette.pink);
    const right = q.options.indexOf(q.answer);
    if (right >= 0) paintBtn(btns[right], palette.teal); // reveal the correct answer
    pendingT = window.setTimeout(() => (lives <= 0 ? finish() : nextQuestion()), 900);
  }

  function choose(i: number) {
    if (over || locked) return;
    if (q.options[i] === q.answer) correct(i);
    else miss(i);
  }

  function finish() {
    over = true;
    const isBest = sdk.submitScore("hisab", score);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 12)), level);
    sdk.addCoins(coins, "Math Rush");
    const need = levelUpAt(level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Out of Lives! 🧮",
      subtitle: leveledUp
        ? `Score ${score} — now Level ${level}: tougher sums, faster clock`
        : `Score ${score} · ${need - score} more to reach Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function reset() {
    window.clearTimeout(pendingT);
    level = sdk.getLevel("hisab");
    score = 0; streak = 0; lives = LIVES;
    over = false; leveledUp = false;
    hud.set("Level", level); hud.set("Score", 0); hud.set("Streak", 0);
    nextQuestion();
  }

  gc.run((dt) => {
    if (!over && !locked) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        miss(-1); // ran out of time — counts as a wrong answer
      }
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    ctx.textBaseline = "middle";
    // lives
    ctx.textAlign = "left";
    ctx.font = "18px system-ui, sans-serif";
    for (let i = 0; i < LIVES; i++) {
      ctx.globalAlpha = i < lives ? 1 : 0.18; ctx.fillText("❤️", 16 + i * 27, 27);
    }
    ctx.globalAlpha = 1;
    // the sum — drawn as big as fits
    ctx.textAlign = "center";
    const label = `${q.text} = ?`;
    let fs = 54;
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    while (fs > 22 && ctx.measureText(label).width > gc.w - 48) {
      fs -= 4;
      ctx.font = `800 ${fs}px system-ui, sans-serif`;
    }
    ctx.fillStyle = palette.cream;
    ctx.fillText(label, gc.w / 2, gc.h * 0.44);
    if (streak >= 2) {
      ctx.font = "700 16px system-ui, sans-serif";
      ctx.fillStyle = palette.marigold;
      ctx.fillText(`🔥 ${streak} in a row · +${streak * 2} bonus`, gc.w / 2, gc.h * 0.63);
    }
    // draining time bar
    const bx = 24, bw = gc.w - 48, bh = 14, by = gc.h - 42;
    roundRect(ctx, bx, by, bw, bh, 7, "rgba(255,248,236,0.14)");
    const frac = Math.max(0, timeLeft / timeMax);
    if (frac > 0)
      roundRect(ctx, bx, by, Math.max(bh, bw * frac), bh, 7,
        frac > 0.5 ? palette.teal : frac > 0.25 ? palette.marigold : palette.pink);
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,248,236,0.65)";
    ctx.fillText(`${timeLeft.toFixed(1)}s`, gc.w / 2, by + bh + 13);
  });

  reset();
  return () => {
    window.clearTimeout(pendingT);
    gc.destroy();
  };
}
