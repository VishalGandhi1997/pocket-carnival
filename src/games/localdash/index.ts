// Traffic Dash — 3-lane taxi dodger. Swipe left/right to switch lanes,
// dodge the city traffic (mind the tractor — it's in no hurry), grab coins.
// The road only gets faster, and each level starts faster and busier.
import { createGameCanvas, palette } from "../../engine/canvas";
import { makeHud, showOverlay, showRevive } from "../../engine/ui";
import { reviveCost } from "../../sdk/economy";
import type { Sdk } from "../../sdk/platform";

interface Ob {
  lane: number;
  y: number;
  e: string; // emoji
  mul: number; // fraction of road speed (tractor crawls at 0.4)
}
interface Pick {
  lane: number;
  y: number;
}

const TRACTOR = "🚜";
const FAST = ["🚗", "🚌", "🛑"]; // full-road-speed obstacles
const ALL = [...FAST, TRACTOR];

// Level ladder — capped so the road never becomes impossible.
const startSpeedFor = (level: number) => 1 + Math.min(0.6, (level - 1) * 0.07); // +7%/lvl, max +60%
const gapMulFor = (level: number) => 1 - Math.min(0.4, (level - 1) * 0.06); // −6%/lvl, max −40%
const pairChanceFor = (level: number) => Math.min(0.5, 0.25 + level * 0.03);
const levelUpAt = (level: number) => 120 + level * 60;

export function mountLocalDash(host: HTMLElement, sdk: Sdk): () => void {
  const hud = makeHud(host, ["Level", "Score", "Best"]);
  let level = sdk.getLevel("localdash");
  const gc = createGameCanvas(host, 1.5); // portrait
  const { ctx } = gc;
  const W = gc.w;
  const H = gc.h;

  // ── Road geometry ──
  const roadX = W * 0.06;
  const roadW = W * 0.88;
  const laneW = roadW / 3;
  const laneX = (l: number) => roadX + laneW * (l + 0.5);
  const size = laneW * 0.5; // obstacle emoji size
  const pSize = laneW * 0.55; // player emoji size
  const playerY = H * 0.82;
  const hitBox = size * 0.75; // ~25% shrunk centre-distance threshold
  const dashLen = H * 0.055;
  const dashPeriod = dashLen + H * 0.045;

  // ── Run state ──
  let obs: Ob[] = [];
  let picks: Pick[] = [];
  let lane = 1;
  let px = laneX(1);
  let score = 0;
  let speedMul = 1;
  let scoreT = 0;
  let spawnT = 0;
  let coinT = 0;
  let dashOff = 0;
  let time = 0;
  let over = false;
  let reviveCount = 0;
  let usedAdRevive = false;

  function reset() {
    level = sdk.getLevel("localdash");
    obs = [];
    picks = [];
    lane = 1;
    px = laneX(1);
    score = 0;
    speedMul = startSpeedFor(level);
    scoreT = spawnT = coinT = dashOff = time = 0;
    over = false;
    reviveCount = 0;
    usedAdRevive = false;
    hud.set("Level", level);
    hud.set("Score", 0);
    hud.set("Best", sdk.getBest("localdash"));
  }

  function addObs(l: number, noSlow: boolean) {
    const pool = noSlow ? FAST : ALL;
    const e = pool[Math.floor(Math.random() * pool.length)];
    obs.push({ lane: l, y: -size, e, mul: e === TRACTOR ? 0.4 : 1 });
  }

  // One spawn event = one lane, or (level-scaled 28–50%) a pair in two lanes —
  // never all three, so a fresh row always leaves an escape lane. While a slow
  // tractor is still on the road we spawn singles only (and no second
  // tractor), so fast traffic catching up to its row can never seal every
  // lane at once.
  function spawn() {
    const slowAlive = obs.some((o) => o.mul < 1);
    const first = Math.floor(Math.random() * 3);
    addObs(first, slowAlive);
    if (!slowAlive && Math.random() < pairChanceFor(level)) {
      const others = [0, 1, 2].filter((l) => l !== first);
      addObs(others[Math.floor(Math.random() * others.length)], true);
    }
  }

  function spawnCoin() {
    const l = Math.floor(Math.random() * 3);
    // Don't drop a coin straight onto freshly-spawned traffic.
    if (obs.some((o) => o.lane === l && o.y < size * 2)) return;
    picks.push({ lane: l, y: -size });
  }

  // Revive wipes the road clean and eases off to 80% speed so the player
  // re-enters with room to breathe (same flow as Naagin).
  function doRevive() {
    obs = [];
    spawnT = -0.4; // extra grace before traffic resumes
    speedMul *= 0.8;
    over = false;
  }

  function crash() {
    over = true;
    sdk.haptic(60);
    const cost = reviveCost(reviveCount);
    showRevive(gc.canvas, {
      coinCost: cost,
      adAvailable: !usedAdRevive,
      onReviveCoins: () => {
        if (sdk.spendCoins(cost)) {
          reviveCount++;
          doRevive();
        } else finishGame();
      },
      onReviveAd: async () => {
        const ok = await sdk.watchAd();
        if (ok) {
          usedAdRevive = true;
          doRevive();
        }
        return ok;
      },
      onDecline: finishGame,
    });
  }

  function finishGame() {
    over = true;
    const isBest = sdk.submitScore("localdash", score);
    const leveledUp = score >= levelUpAt(level);
    if (leveledUp) {
      level += 1;
      sdk.setLevel("localdash", level);
    }
    const coins = sdk.scaleReward(Math.max(1, Math.floor(score / 10)), level);
    sdk.addCoins(coins, "Traffic Dash");
    hud.set("Best", sdk.getBest("localdash"));
    hud.set("Level", level);
    const need = levelUpAt(level);
    showOverlay(gc.canvas, {
      title: leveledUp ? "⬆️ Level Up!" : "Crash! 🚕",
      subtitle: leveledUp
        ? `Now Level ${level} — faster road, heavier traffic`
        : `Score ${score} · ${Math.max(0, need - score)} more to reach Level ${level + 1}`,
      coins,
      isBest,
      mood: leveledUp ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  gc.onSwipe((d) => {
    if (over || (d !== "left" && d !== "right")) return;
    const next = Math.min(2, Math.max(0, lane + (d === "left" ? -1 : 1)));
    if (next !== lane) {
      lane = next;
      sdk.haptic();
    }
  });

  function update(dt: number) {
    time += dt;
    speedMul = Math.min(2.2, speedMul * (1 + 0.02 * dt)); // +2%/s, capped
    const spd = H * 0.45 * speedMul;
    // Ease toward the lane centre — ~95% of the way in 0.12s.
    px += (laneX(lane) - px) * (1 - Math.exp(-dt / 0.04));
    dashOff = (dashOff + spd * dt) % dashPeriod;

    scoreT += dt; // +1 per 0.5s survived
    while (scoreT >= 0.5) {
      scoreT -= 0.5;
      score += 1;
      hud.set("Score", score);
    }

    spawnT += dt;
    // Base gap tightens with speed; the level multiplier squeezes it further,
    // with a hard floor so rows never stack too close to weave through.
    const spawnGap = Math.max(0.4, Math.max(0.55, 1 - (speedMul - 1) * 0.3) * gapMulFor(level));
    if (spawnT >= spawnGap) {
      spawnT = 0;
      spawn();
    }
    coinT += dt;
    if (coinT >= 2.5) {
      coinT = 0;
      spawnCoin();
    }

    for (const o of obs) o.y += spd * o.mul * dt;
    obs = obs.filter((o) => o.y < H + size);
    for (const c of picks) c.y += spd * dt;
    picks = picks.filter((c) => {
      if (Math.abs(laneX(c.lane) - px) < laneW * 0.4 && Math.abs(c.y - playerY) < size * 0.8) {
        score += 5;
        hud.set("Score", score);
        sdk.sfx("coin");
        return false;
      }
      return c.y < H + size;
    });

    for (const o of obs) {
      if (Math.abs(laneX(o.lane) - px) < hitBox && Math.abs(o.y - playerY) < hitBox) {
        crash();
        return;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = palette.bg; // roadside strips
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = palette.ink; // asphalt
    ctx.fillRect(roadX, 0, roadW, H);
    ctx.fillStyle = palette.marigold; // painted edge lines
    ctx.fillRect(roadX - 2, 0, 4, H);
    ctx.fillRect(roadX + roadW - 2, 0, 4, H);
    // Lane-divider dashes + kerb ticks scroll downward to sell the speed.
    ctx.fillStyle = "rgba(255,248,236,0.5)";
    for (let b = 1; b <= 2; b++)
      for (let y = dashOff - dashPeriod; y < H; y += dashPeriod)
        ctx.fillRect(roadX + laneW * b - 2, y, 4, dashLen);
    ctx.fillStyle = "rgba(255,248,236,0.25)";
    for (let y = (dashOff * 2) % (dashPeriod * 2) - dashPeriod * 2; y < H; y += dashPeriod * 2) {
      ctx.fillRect(W * 0.015, y, W * 0.025, dashLen * 0.6);
      ctx.fillRect(W * 0.96, y, W * 0.025, dashLen * 0.6);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${size * 0.8}px sans-serif`;
    for (const c of picks) ctx.fillText("🪙", laneX(c.lane), c.y);
    for (const o of obs) {
      ctx.font = `${size * (o.e === "🚌" ? 1.15 : 1)}px sans-serif`;
      ctx.fillText(o.e, laneX(o.lane), o.y);
    }
    // Player taxi with a soft shadow and a little engine bob.
    ctx.beginPath();
    ctx.ellipse(px, playerY + pSize * 0.42, pSize * 0.36, pSize * 0.1, 0, 0, 7);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    ctx.font = `${pSize}px sans-serif`;
    ctx.fillText("🚕", px, playerY + Math.sin(time * 18) * H * 0.002);
  }

  gc.run((dt) => {
    if (!over) update(dt);
    draw();
  });

  reset();
  return () => gc.destroy();
}
