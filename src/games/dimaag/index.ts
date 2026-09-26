// Quiz Duel — rapid-fire trivia duel. 10 questions per match.
// Modes: vs Bot (the bot answers every question alongside you; its accuracy
// rises and your per-question timer shrinks with your persistent level —
// beat the bot to level up) or Pass & Play (players alternate questions on
// one phone; a friendly, unleveled 10-second-per-question match).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, makeTurnBanner, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

interface Question {
  q: string;
  opts: [string, string, string, string];
  a: number; // index of the correct option
}

// Original in-house question bank — short, mixed math / world GK / logic.
const BANK: Question[] = [
  { q: "What is 12 × 8?", opts: ["88", "92", "96", "108"], a: 2 },
  { q: "What is 15 + 27?", opts: ["40", "42", "44", "52"], a: 1 },
  { q: "What is 144 ÷ 12?", opts: ["10", "11", "12", "14"], a: 2 },
  { q: "What is 9 × 7?", opts: ["56", "61", "63", "72"], a: 2 },
  { q: "What is 100 − 45?", opts: ["45", "50", "55", "65"], a: 2 },
  { q: "What is half of 90?", opts: ["40", "45", "50", "55"], a: 1 },
  { q: "What is 25 × 4?", opts: ["75", "90", "100", "125"], a: 2 },
  { q: "What is 7 squared?", opts: ["14", "21", "49", "77"], a: 2 },
  { q: "What comes next: 2, 4, 8, 16, …?", opts: ["20", "24", "32", "64"], a: 2 },
  { q: "How many minutes in an hour and a half?", opts: ["60", "75", "90", "120"], a: 2 },
  { q: "How many sides does a hexagon have?", opts: ["5", "6", "7", "8"], a: 1 },
  { q: "How many days are in a leap year?", opts: ["364", "365", "366", "367"], a: 2 },
  { q: "What is the capital of Australia?", opts: ["Sydney", "Melbourne", "Canberra", "Perth"], a: 2 },
  { q: "What is the capital of Japan?", opts: ["Kyoto", "Osaka", "Tokyo", "Seoul"], a: 2 },
  { q: "What is the capital of France?", opts: ["Lyon", "Paris", "Rome", "Berlin"], a: 1 },
  { q: "Which planet is called the Red Planet?", opts: ["Venus", "Jupiter", "Mars", "Saturn"], a: 2 },
  { q: "Which is the largest planet?", opts: ["Earth", "Saturn", "Neptune", "Jupiter"], a: 3 },
  { q: "How many players does a soccer team have on the field?", opts: ["9", "10", "11", "12"], a: 2 },
  { q: "How many colours are in a rainbow?", opts: ["5", "6", "7", "8"], a: 2 },
  { q: "Which is the largest ocean?", opts: ["Atlantic", "Indian", "Arctic", "Pacific"], a: 3 },
  { q: "Which is the tallest animal?", opts: ["Elephant", "Giraffe", "Camel", "Horse"], a: 1 },
  { q: "How many legs does a spider have?", opts: ["4", "6", "8", "10"], a: 2 },
  { q: "Which gas do plants take in?", opts: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], a: 1 },
  { q: "Which is the largest mammal?", opts: ["Elephant", "Blue whale", "Giraffe", "Hippo"], a: 1 },
  { q: "How many continents are there?", opts: ["5", "6", "7", "8"], a: 2 },
  { q: "Which is the fastest land animal?", opts: ["Lion", "Horse", "Cheetah", "Kangaroo"], a: 2 },
  { q: "Which planet is closest to the Sun?", opts: ["Venus", "Mercury", "Earth", "Mars"], a: 1 },
  { q: "At sea level, water boils at how many °C?", opts: ["90", "100", "110", "120"], a: 1 },
  { q: "How many zeros are in one million?", opts: ["5", "6", "7", "8"], a: 1 },
  { q: "How many weeks are in a year?", opts: ["48", "50", "52", "54"], a: 2 },
  { q: "How many hours are in two days?", opts: ["24", "36", "48", "72"], a: 2 },
  { q: "What sweet food do bees make?", opts: ["Jam", "Honey", "Sugar", "Syrup"], a: 1 },
  { q: "Which word reads the same backwards?", opts: ["TABLE", "LEVEL", "CHAIR", "PLANT"], a: 1 },
  { q: "Which is heavier: 1 kg cotton or 1 kg iron?", opts: ["Cotton", "Iron", "Both the same", "Cannot say"], a: 2 },
  { q: "Odd one out: Apple, Mango, Potato, Banana?", opts: ["Apple", "Mango", "Potato", "Banana"], a: 2 },
  { q: "How many letters are in the word SMILE?", opts: ["4", "5", "6", "7"], a: 1 },
];

const ROUNDS = 10;
const PNP_TIME = 10; // seconds per question in Pass & Play (unleveled)

// Bot-mode level curve: Lv1 bot is a coin-flip (50%), +5% per level up to
// 88%; the question timer drops 1s every 2 levels from 10s down to 6s.
const botAccuracy = (level: number) => Math.min(0.88, 0.5 + (level - 1) * 0.05);
const botModeTime = (level: number) => Math.max(6, 10 - Math.floor((level - 1) / 2));

export function mountDimaag(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  const oppName = mode === "bot" ? "Bot" : "P2";
  const hud = mode === "bot" ? makeHud(host, ["Level"]) : null;
  const banner = makeTurnBanner(host);
  const gc = createGameCanvas(host, 0.9);
  const { ctx } = gc;

  let deck: Question[] = [];
  let round = 0;
  let you = 0;
  let opp = 0;
  let level = mode === "bot" ? sdk.getLevel("dimaag") : 1;
  let qTime = PNP_TIME;
  let timeLeft = qTime;
  let locked = true; // input frozen between questions / after the match
  let over = false;
  let pendingT = 0;

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Who answers this round: 0 = You/P1, 1 = P2. Odd rounds → P1 in pnp. */
  function answeringSide(): 0 | 1 {
    return mode === "pnp" && round % 2 === 1 ? 1 : 0;
  }

  function refreshBanner() {
    if (over) return;
    if (mode === "bot") banner.set(`💡 Round ${round + 1} — beat 🤖 Bot (Lv ${level})!`, "you");
    else if (answeringSide() === 0) banner.set(`💡 Round ${round + 1} — Player 1 answers!`, "you");
    else banner.set(`💡 Round ${round + 1} — Player 2 answers!`, "opp");
  }

  // ── The four answer options are DOM buttons below the canvas ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  controls.style.flexWrap = "wrap";
  const btns: HTMLButtonElement[] = [];
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button");
    b.className = "btn-ghost";
    b.style.cssText = "flex:1 1 100%;width:100%;max-width:440px;margin:0 auto;";
    b.addEventListener("click", () => answer(i));
    btns.push(b);
    controls.appendChild(b);
  }
  host.appendChild(controls);

  function paint(b: HTMLButtonElement, color: string) {
    b.style.background = color;
    b.style.borderColor = color;
    b.style.color = palette.ink;
  }

  function clearPaint(b: HTMLButtonElement) {
    b.style.background = "";
    b.style.borderColor = "";
    b.style.color = "";
  }

  function nextQuestion() {
    const q = deck[round];
    timeLeft = qTime;
    btns.forEach((b, i) => {
      b.textContent = q.opts[i];
      b.disabled = false;
      clearPaint(b);
    });
    locked = false;
    refreshBanner();
  }

  /** choice = -1 means the timer ran out (counts as wrong). */
  function answer(choice: number) {
    if (locked || over) return;
    locked = true;
    btns.forEach((b) => (b.disabled = true));
    const q = deck[round];
    if (choice === q.a) {
      if (answeringSide() === 0) you += 10;
      else opp += 10;
      sdk.sfx("coin");
      paint(btns[choice], palette.teal);
    } else {
      sdk.sfx("pop");
      if (choice >= 0) paint(btns[choice], palette.pink);
      paint(btns[q.a], palette.teal); // briefly reveal the right answer
    }
    if (mode === "bot" && Math.random() < botAccuracy(level)) opp += 10; // bot answers simultaneously
    pendingT = window.setTimeout(() => {
      round++;
      if (round >= ROUNDS) finish();
      else nextQuestion();
    }, 800);
  }

  function finish() {
    over = true;
    const youWon = you > opp;
    const tie = you === opp;
    const played = level;
    const coins = youWon ? sdk.scaleReward(25, played) : sdk.scaleReward(5, played);
    if (youWon) sdk.submitScore("dimaag", sdk.getBest("dimaag") + 1);
    sdk.addCoins(coins, "Quiz Duel");
    // Bot mode only: beating the bot climbs the persistent ladder.
    const leveledUp = mode === "bot" && youWon;
    if (leveledUp) {
      level += 1;
      sdk.setLevel("dimaag", level);
      hud?.set("Level", level);
    }
    banner.set(youWon ? "🏆 You Won!" : tie ? "🤝 It's a Tie" : `${oppName} Wins`, youWon ? "you" : "opp");
    const acc = Math.round(botAccuracy(level) * 100);
    let subtitle = `${you} – ${opp}`;
    if (leveledUp) subtitle = `Big Brain Win! ${you} – ${opp} · Level ${level} — sharper bot (${acc}%), ${botModeTime(level)}s per question`;
    else if (mode === "bot") subtitle = `${you} – ${opp} · Beat the Bot (Lv ${level}) to reach Level ${level + 1}`;
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : youWon ? "Big Brain Win! 💡" : tie ? "It's a Tie" : "Next Time!",
      subtitle,
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function reset() {
    if (mode === "bot") {
      level = sdk.getLevel("dimaag");
      qTime = botModeTime(level);
      hud?.set("Level", level);
    } else qTime = PNP_TIME;
    deck = shuffle([...BANK]).slice(0, ROUNDS); // fresh shuffle, no repeats in a match
    round = 0;
    you = 0;
    opp = 0;
    over = false;
    nextQuestion();
  }

  function wrapLines(text: string, maxW: number): string[] {
    const out: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
    return out;
  }

  gc.run((dt) => {
    if (!locked && !over) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        answer(-1); // timeout = wrong
      }
    }

    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);

    // timer bar across the top
    const frac = timeLeft / qTime;
    roundRect(ctx, 14, 12, gc.w - 28, 10, 5, "rgba(255,248,236,0.18)");
    if (frac > 0.02) {
      const barColor = frac > 0.5 ? palette.teal : frac > 0.25 ? palette.marigold : palette.pink;
      roundRect(ctx, 14, 12, (gc.w - 28) * frac, 10, 5, barColor);
    }

    // round counter
    ctx.fillStyle = "rgba(255,248,236,0.7)";
    ctx.font = '700 13px "Nunito Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(over ? "Match over" : `Round ${Math.min(round + 1, ROUNDS)} of ${ROUNDS}`, gc.w / 2, 40);

    // question card with word-wrapped text
    const cardY = 56;
    const cardH = gc.h - cardY - 76;
    roundRect(ctx, 16, cardY, gc.w - 32, cardH, 14, palette.board);
    const q = deck[Math.min(round, ROUNDS - 1)];
    if (q) {
      ctx.fillStyle = palette.cream;
      ctx.font = '800 20px "Nunito Sans", sans-serif';
      const lines = wrapLines(q.q, gc.w - 72);
      const lh = 27;
      const y0 = cardY + cardH / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((ln, i) => ctx.fillText(ln, gc.w / 2, y0 + i * lh));
    }

    // score chips — You (teal) vs Bot/P2 (pink)
    const chipW = (gc.w - 44) / 2;
    const chipY = gc.h - 60;
    roundRect(ctx, 16, chipY, chipW, 44, 12, palette.teal);
    roundRect(ctx, gc.w - 16 - chipW, chipY, chipW, 44, 12, palette.pink);
    if (mode === "pnp" && !over) {
      // outline whose turn it is
      ctx.strokeStyle = palette.cream;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(answeringSide() === 0 ? 16 : gc.w - 16 - chipW, chipY, chipW, 44, 12);
      ctx.stroke();
    }
    ctx.fillStyle = palette.ink;
    ctx.font = '800 16px "Nunito Sans", sans-serif';
    ctx.fillText(`You ${you}`, 16 + chipW / 2, chipY + 22);
    ctx.fillText(`${oppName} ${opp}`, gc.w - 16 - chipW / 2, chipY + 22);
  });

  reset();

  return () => {
    window.clearTimeout(pendingT);
    gc.destroy();
  };
}
