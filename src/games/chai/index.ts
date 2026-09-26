// Café Empire — session idle-tapper. Tap the cup to brew coffee by hand,
// hire helpers that brew per-second, then cash out: gross cups → coins.
// Each level sets a brew goal for the session; hit it to level up, then keep
// brewing toward the next goal or cash out. Higher levels = pricier upgrades.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const CUPS_PER_COIN = 150; // gross cups per 1 coin at cash-out

// Session brew goal for a level, and the upgrade price multiplier at it.
const goalFor = (level: number) => Math.round(1000 * Math.pow(level, 1.5));
const costMulFor = (level: number) => 1 + (level - 1) * 0.15;
const FLOAT_LIFE = 0.9; // seconds a "+N" float text lives

interface FloatText {
  x: number;
  y: number;
  age: number;
  text: string;
}

interface Upgrade {
  icon: string;
  name: string;
  base: number;
  mult: number; // cost multiplier per purchase
  rate: number; // +cups/sec per purchase
  tap: number; // +tap power per purchase
  cost: number;
  owned: number;
  btn: HTMLButtonElement;
}

export function mountChai(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Cups", "Per Sec"]);
  let level = sdk.getLevel("chai");
  const gc = createGameCanvas(host, 1.2);
  const { ctx } = gc;

  let cups = 0; // spendable balance
  let totalEarned = 0; // gross brewed (taps + passive) — payout, score & goal
  let goal = goalFor(level); // session total needed for the next level
  let leveledUp = false; // reached at least one goal this session
  let paused = false; // Level Up! overlay is showing
  let levelUpOv: HTMLElement | null = null;
  let perSec = 0;
  let tapPower = 1;
  let squash = 0; // 0..1 glass pulse after a tap
  let over = false;
  const floats: FloatText[] = [];

  const defs = [
    { icon: "🧑‍🍳", name: "Assistant", base: 50, mult: 1.6, rate: 1, tap: 0 },
    { icon: "🔥", name: "Stove", base: 250, mult: 1.6, rate: 6, tap: 0 },
    { icon: "🏪", name: "Franchise", base: 1200, mult: 1.6, rate: 25, tap: 0 },
    { icon: "💪", name: "Strong Tap", base: 100, mult: 2, rate: 0, tap: 1 },
  ];
  const ups: Upgrade[] = defs.map((d) => ({
    ...d,
    cost: d.base,
    owned: 0,
    btn: document.createElement("button"),
  }));

  function labelButtons() {
    for (const u of ups) u.btn.textContent = `${u.icon} ${u.name} · ${u.cost}`;
  }

  function buy(u: Upgrade) {
    if (over || paused || cups < u.cost) return;
    cups -= u.cost;
    u.owned++;
    perSec += u.rate;
    tapPower += u.tap;
    u.cost = Math.round(u.cost * u.mult);
    sdk.sfx("coin");
    labelButtons();
  }

  function reset() {
    level = sdk.getLevel("chai");
    goal = goalFor(level);
    leveledUp = false;
    paused = false;
    cups = 0;
    totalEarned = 0;
    perSec = 0;
    tapPower = 1;
    squash = 0;
    floats.length = 0;
    const mul = costMulFor(level);
    for (const u of ups) {
      u.cost = Math.round(u.base * mul);
      u.owned = 0;
    }
    labelButtons();
    hud.set("Level", level);
    over = false;
  }

  // Goal reached mid-session: bump the level, pause brewing behind the
  // Level Up! moment, then let the player keep going toward the next goal.
  function levelUp() {
    level += 1;
    sdk.setLevel("chai", level);
    leveledUp = true;
    goal = goalFor(level);
    hud.set("Level", level);
    paused = true;
    levelUpOv = showOverlay(gc.canvas, {
      title: "⬆️ Level Up!",
      subtitle: `Level ${level} — pricier upgrades next shift, next goal ${goal} cups`,
      mood: "win",
      primaryLabel: "Keep Brewing ☕",
      onPrimary: () => {
        paused = false;
        levelUpOv = null;
      },
    });
  }

  function cashOut() {
    if (over) return;
    // Cashing out straight from the Level Up! moment is allowed.
    levelUpOv?.remove();
    levelUpOv = null;
    paused = false;
    over = true;
    const brewed = Math.floor(totalEarned);
    const coins = sdk.scaleReward(Math.max(1, Math.floor(totalEarned / CUPS_PER_COIN)), level);
    const isBest = sdk.submitScore("chai", brewed);
    sdk.addCoins(coins, "Café Empire");
    showOverlay(gc.canvas, {
      title: "Café Closed! ☕",
      subtitle: leveledUp
        ? `${brewed} cups brewed · now Level ${level}`
        : `${brewed} cups brewed · ${Math.max(0, goal - brewed)} more for Level ${level + 1}`,
      coins,
      isBest,
      mood: "win",
      primaryLabel: "Open Again",
      onPrimary: reset,
    });
  }

  gc.onDown((p) => {
    if (over || paused) return;
    cups += tapPower;
    totalEarned += tapPower;
    squash = 1;
    floats.push({ x: p.x + (Math.random() - 0.5) * 24, y: p.y, age: 0, text: `+${tapPower}` });
    sdk.haptic();
  });

  gc.run((dt) => {
    if (!over && !paused && perSec > 0) {
      cups += perSec * dt;
      totalEarned += perSec * dt;
    }
    if (!over && !paused && totalEarned >= goal) levelUp();
    squash = Math.max(0, squash - dt * 6);

    // ── scene ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);

    // counter the cup sits on
    const cx = gc.w / 2;
    const cupSize = gc.w * 0.32;
    const counterY = gc.h * 0.52 + cupSize * 0.42;
    roundRect(ctx, 14, counterY, gc.w - 28, gc.h - counterY - 14, 14, "#7a4a21");
    roundRect(ctx, 14, counterY, gc.w - 28, 12, 6, "#9c6430");

    // big coffee cup with a quick squash pulse on tap
    ctx.save();
    ctx.translate(cx, gc.h * 0.52);
    ctx.scale(1 + squash * 0.1, 1 - squash * 0.14);
    ctx.font = `${cupSize}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("☕", 0, 0);
    ctx.restore();

    // totals, top-center
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = palette.cream;
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText(`${Math.floor(cups)}`, cx, 64);
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillStyle = palette.marigold;
    ctx.fillText(`cups · +${perSec}/sec`, cx, 88);

    // session goal progress bar → next level
    const gx = gc.w * 0.18;
    const gw = gc.w * 0.64;
    const gy = 104;
    const frac = Math.min(1, totalEarned / goal);
    roundRect(ctx, gx, gy, gw, 10, 5, "rgba(255,248,236,0.14)");
    if (frac > 0) roundRect(ctx, gx, gy, Math.max(10, gw * frac), 10, 5, palette.teal);
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,248,236,0.7)";
    ctx.fillText(`Goal: ${Math.floor(totalEarned)} / ${goal} cups → Level ${level + 1}`, cx, gy + 28);

    // owned-upgrade indicator row on the counter face
    const ownedRow = ups.filter((u) => u.owned > 0).map((u) => `${u.icon}×${u.owned}`).join("  ");
    if (ownedRow) {
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillStyle = palette.cream;
      ctx.fillText(ownedRow, cx, gc.h - 26);
    }
    if (totalEarned === 0) {
      ctx.font = "600 16px system-ui, sans-serif";
      ctx.fillStyle = palette.sky;
      ctx.fillText("Tap anywhere to brew! 👆", cx, gc.h * 0.31);
    }

    // rising, fading "+N" floats
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.age += dt;
      if (f.age >= FLOAT_LIFE) {
        floats.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - f.age / FLOAT_LIFE;
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillStyle = palette.teal;
      ctx.fillText(f.text, f.x, f.y - f.age * 70);
    }
    ctx.globalAlpha = 1;

    // keep DOM in sync: HUD numbers + upgrade affordability dimming
    hud.set("Cups", Math.floor(cups));
    hud.set("Per Sec", Math.round(perSec));
    for (const u of ups) {
      const can = !over && !paused && cups >= u.cost;
      if (u.btn.disabled === can) {
        u.btn.disabled = !can;
        u.btn.style.opacity = can ? "1" : "0.45";
      }
    }
  });

  // ── upgrade + cash-out controls ──
  const controls = document.createElement("div");
  controls.className = "game-controls";
  for (const u of ups) {
    u.btn.className = "btn-ghost";
    u.btn.addEventListener("click", () => buy(u));
    controls.appendChild(u.btn);
  }
  const cashBtn = document.createElement("button");
  cashBtn.className = "btn-primary";
  cashBtn.textContent = "💰 Cash Out";
  cashBtn.addEventListener("click", cashOut);
  controls.appendChild(cashBtn);
  host.appendChild(controls);

  reset();
  return () => gc.destroy();
}
