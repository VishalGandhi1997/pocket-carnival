// Visual celebration engine — confetti bursts, coins that arc-fly into the
// wallet, floating score text, and screen shake. Pure DOM/Canvas + WAAPI,
// zero dependencies. All effects respect prefers-reduced-motion.

import { play } from "./sfx";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Confetti ── one fixed full-screen canvas, rAF runs only while alive.
const COLORS = ["#ffd75e", "#ff5c8a", "#2ee6a8", "#4cc9f0", "#c77dff", "#fff8ec"];

interface Piece {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number;
  color: string; life: number;
}

let confettiCanvas: HTMLCanvasElement | null = null;
let pieces: Piece[] = [];
let confettiRaf = 0;

function confettiCtx(): CanvasRenderingContext2D {
  if (!confettiCanvas) {
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:300;";
    document.body.appendChild(confettiCanvas);
  }
  confettiCanvas.width = innerWidth;
  confettiCanvas.height = innerHeight;
  return confettiCanvas.getContext("2d")!;
}

/** Burst of confetti from a point (defaults to upper-center of `from`). */
export function confetti(from?: Element, count = 90) {
  if (reducedMotion()) return;
  const r = from?.getBoundingClientRect();
  const cx = r ? r.left + r.width / 2 : innerWidth / 2;
  const cy = r ? r.top + r.height * 0.35 : innerHeight * 0.4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    pieces.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[i % COLORS.length],
      life: 1,
    });
  }
  if (!confettiRaf) {
    const ctx = confettiCtx();
    const step = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      pieces = pieces.filter((p) => p.life > 0);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.32; // gravity
        p.vx *= 0.985;
        p.rot += p.vr;
        p.life -= 0.011;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (pieces.length) {
        confettiRaf = requestAnimationFrame(step);
      } else {
        confettiRaf = 0;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
      }
    };
    confettiRaf = requestAnimationFrame(step);
  }
}

// ── Coin flight ── emoji coins arc from a source element into the wallet.
export function flyCoins(from: Element, count = 6) {
  const target = document.querySelector(".wallet");
  if (!target) return;
  const f = from.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const n = reducedMotion() ? 1 : Math.min(count, 10);
  for (let i = 0; i < n; i++) {
    const coin = document.createElement("span");
    coin.textContent = "🪙";
    const sx = f.left + f.width / 2 + (Math.random() - 0.5) * 60;
    const sy = f.top + f.height / 2 + (Math.random() - 0.5) * 30;
    const ex = t.left + t.width / 2;
    const ey = t.top + t.height / 2;
    coin.style.cssText = `position:fixed;left:${sx}px;top:${sy}px;font-size:22px;z-index:310;pointer-events:none;will-change:transform;`;
    document.body.appendChild(coin);
    // arc: rise up and out first, then home in on the wallet
    const midX = (ex - sx) * 0.35 + (Math.random() - 0.5) * 90;
    const midY = (ey - sy) * 0.2 - 70 - Math.random() * 50;
    const anim = coin.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${midX}px,${midY}px) scale(1.25)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${ex - sx}px,${ey - sy}px) scale(0.4)`, opacity: 0.9 },
      ],
      {
        duration: reducedMotion() ? 10 : 620 + i * 90,
        delay: i * 70,
        easing: "cubic-bezier(0.3, 0, 0.4, 1)",
        fill: "forwards",
      },
    );
    anim.onfinish = () => {
      coin.remove();
      play("coin");
      target.classList.remove("bump");
      // restart the bump animation
      void (target as HTMLElement).offsetWidth;
      target.classList.add("bump");
    };
  }
}

// ── Floating score text ── "+12" drifting up from a point inside a host.
export function floatText(host: Element, x: number, y: number, text: string, color = "#ffd75e") {
  const el = document.createElement("span");
  el.textContent = text;
  el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);` +
    `font-family:"Baloo 2",sans-serif;font-weight:800;font-size:22px;color:${color};` +
    `text-shadow:0 2px 0 rgba(0,0,0,.45);pointer-events:none;z-index:6;will-change:transform,opacity;`;
  (host as HTMLElement).appendChild(el);
  el.animate(
    [
      { transform: "translate(-50%,-50%) scale(0.6)", opacity: 0 },
      { transform: "translate(-50%,-90%) scale(1.15)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%,-220%) scale(1)", opacity: 0 },
    ],
    { duration: reducedMotion() ? 10 : 850, easing: "cubic-bezier(0.2,0.7,0.3,1)", fill: "forwards" },
  ).onfinish = () => el.remove();
}

// ── Screen shake ── quick rattle on a wrapper element.
export function shake(el: Element) {
  if (reducedMotion()) return;
  el.animate(
    [
      { transform: "translate(0,0)" },
      { transform: "translate(-5px,2px)" },
      { transform: "translate(4px,-2px)" },
      { transform: "translate(-3px,1px)" },
      { transform: "translate(2px,0)" },
      { transform: "translate(0,0)" },
    ],
    { duration: 280, easing: "linear" },
  );
}
