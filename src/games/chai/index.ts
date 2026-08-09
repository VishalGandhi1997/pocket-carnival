// Chai Empire — session idle-tapper. Tap the glass to brew chai by hand,
// hire helpers that brew per-second, then cash out: gross chai → coins.
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeHud, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const CHAI_PER_COIN = 150; // gross chai per 1 coin at cash-out
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
  rate: number; // +chai/sec per purchase
  tap: number; // +tap power per purchase
  cost: number;
  owned: number;
  btn: HTMLButtonElement;
}

export function mountChai(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Chai", "Per Sec"]);
  const gc = createGameCanvas(host, 1.2);
  const { ctx } = gc;

  let chai = 0; // spendable balance
  let totalChaiEarned = 0; // gross brewed (taps + passive) — payout & score
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
    if (over || chai < u.cost) return;
    chai -= u.cost;
    u.owned++;
    perSec += u.rate;
    tapPower += u.tap;
    u.cost = Math.round(u.cost * u.mult);
    sdk.sfx("coin");
    labelButtons();
  }

  function reset() {
    chai = 0;
    totalChaiEarned = 0;
    perSec = 0;
    tapPower = 1;
    squash = 0;
    floats.length = 0;
    for (const u of ups) {
      u.cost = u.base;
      u.owned = 0;
    }
    labelButtons();
    over = false;
  }

  function cashOut() {
    if (over) return;
    over = true;
    const coins = sdk.scaleReward(Math.max(1, Math.floor(totalChaiEarned / CHAI_PER_COIN)), 1);
    const isBest = sdk.submitScore("chai", Math.floor(totalChaiEarned));
    sdk.addCoins(coins, "Chai Empire");
    showOverlay(gc.canvas, {
      title: "Shop Closed! ☕",
      subtitle: `${Math.floor(totalChaiEarned)} chai brewed`,
      coins,
      isBest,
      primaryLabel: "Open Again",
      onPrimary: reset,
    });
  }

  gc.onDown((p) => {
    if (over) return;
    chai += tapPower;
    totalChaiEarned += tapPower;
    squash = 1;
    floats.push({ x: p.x + (Math.random() - 0.5) * 24, y: p.y, age: 0, text: `+${tapPower}` });
    sdk.haptic();
  });

  gc.run((dt) => {
    if (!over && perSec > 0) {
      chai += perSec * dt;
      totalChaiEarned += perSec * dt;
    }
    squash = Math.max(0, squash - dt * 6);

    // ── scene ──
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);

    // counter the glass sits on
    const cx = gc.w / 2;
    const glassSize = gc.w * 0.32;
    const counterY = gc.h * 0.52 + glassSize * 0.42;
    roundRect(ctx, 14, counterY, gc.w - 28, gc.h - counterY - 14, 14, "#7a4a21");
    roundRect(ctx, 14, counterY, gc.w - 28, 12, 6, "#9c6430");

    // big chai glass with a quick squash pulse on tap
    ctx.save();
    ctx.translate(cx, gc.h * 0.52);
    ctx.scale(1 + squash * 0.1, 1 - squash * 0.14);
    ctx.font = `${glassSize}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("☕", 0, 0);
    ctx.restore();

    // totals, top-center
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = palette.cream;
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText(`${Math.floor(chai)}`, cx, 64);
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillStyle = palette.marigold;
    ctx.fillText(`chai · +${perSec}/sec`, cx, 88);

    // owned-upgrade indicator row on the counter face
    const ownedRow = ups.filter((u) => u.owned > 0).map((u) => `${u.icon}×${u.owned}`).join("  ");
    if (ownedRow) {
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillStyle = palette.cream;
      ctx.fillText(ownedRow, cx, gc.h - 26);
    }
    if (totalChaiEarned === 0) {
      ctx.font = "600 16px system-ui, sans-serif";
      ctx.fillStyle = palette.sky;
      ctx.fillText("Tap anywhere to brew! 👆", cx, gc.h * 0.24);
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
    hud.set("Chai", Math.floor(chai));
    hud.set("Per Sec", Math.round(perSec));
    for (const u of ups) {
      const can = !over && chai >= u.cost;
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

  labelButtons();
  return () => gc.destroy();
}
