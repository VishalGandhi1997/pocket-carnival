// Tiny shared canvas harness for mini-games: DPI-correct sizing,
// rAF loop, unified pointer + swipe input, and cleanup in one place.

export interface Pointer {
  x: number;
  y: number;
}

/**
 * Converts a raw PointerEvent to CSS-pixel canvas-local coordinates.
 * Used by games that need true multi-touch (e.g. two simultaneous
 * fingers for same-screen local multiplayer) and must bypass the
 * single-pointer onDown/onMove/onUp helpers below.
 */
export function localPoint(canvas: HTMLCanvasElement, e: PointerEvent, cssW: number, cssH: number): Pointer {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * cssW,
    y: ((e.clientY - r.top) / r.height) * cssH,
  };
}

export interface GameCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** CSS-pixel width/height (draw coordinates). */
  w: number;
  h: number;
  onDown(fn: (p: Pointer) => void): void;
  onMove(fn: (p: Pointer) => void): void;
  onUp(fn: (p: Pointer) => void): void;
  onSwipe(fn: (dir: "up" | "down" | "left" | "right") => void): void;
  /** Start the rAF loop. dt is in seconds, clamped. */
  run(frame: (dt: number) => void): void;
  destroy(): void;
}

export function createGameCanvas(
  host: HTMLElement,
  aspect: number, // height / width
  maxW = 480,
): GameCanvas {
  const canvas = document.createElement("canvas");
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;margin:0 auto;width:100%;";
  wrap.appendChild(canvas);
  host.appendChild(wrap);

  const cssW = Math.min(host.clientWidth || maxW, maxW);
  const cssH = Math.round(cssW * aspect);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  wrap.style.maxWidth = cssW + "px";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const downFns: ((p: Pointer) => void)[] = [];
  const moveFns: ((p: Pointer) => void)[] = [];
  const upFns: ((p: Pointer) => void)[] = [];
  const swipeFns: ((d: "up" | "down" | "left" | "right") => void)[] = [];

  function pt(e: PointerEvent): Pointer {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * cssW,
      y: ((e.clientY - r.top) / r.height) * cssH,
    };
  }

  let swipeStart: Pointer | null = null;

  const hDown = (e: PointerEvent) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = pt(e);
    swipeStart = p;
    downFns.forEach((f) => f(p));
  };
  const hMove = (e: PointerEvent) => {
    const p = pt(e);
    moveFns.forEach((f) => f(p));
  };
  const hUp = (e: PointerEvent) => {
    const p = pt(e);
    upFns.forEach((f) => f(p));
    if (swipeStart && swipeFns.length) {
      const dx = p.x - swipeStart.x;
      const dy = p.y - swipeStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
        const dir =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "right"
              : "left"
            : dy > 0
              ? "down"
              : "up";
        swipeFns.forEach((f) => f(dir));
      }
    }
    swipeStart = null;
  };

  canvas.addEventListener("pointerdown", hDown);
  canvas.addEventListener("pointermove", hMove);
  canvas.addEventListener("pointerup", hUp);

  const keyMap: Record<string, "up" | "down" | "left" | "right"> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  const hKey = (e: KeyboardEvent) => {
    const d = keyMap[e.key];
    if (d && swipeFns.length) {
      e.preventDefault();
      swipeFns.forEach((f) => f(d));
    }
  };
  window.addEventListener("keydown", hKey);

  let raf = 0;
  let last = 0;
  let frameFn: ((dt: number) => void) | null = null;

  function loop(t: number) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    frameFn?.(dt);
    raf = requestAnimationFrame(loop);
  }

  return {
    canvas,
    ctx,
    w: cssW,
    h: cssH,
    onDown: (f) => downFns.push(f),
    onMove: (f) => moveFns.push(f),
    onUp: (f) => upFns.push(f),
    onSwipe: (f) => swipeFns.push(f),
    run(f) {
      frameFn = f;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", hKey);
      canvas.removeEventListener("pointerdown", hDown);
      canvas.removeEventListener("pointermove", hMove);
      canvas.removeEventListener("pointerup", hUp);
      wrap.remove();
    },
  };
}

// ── Shared drawing helpers (brand palette lives here so all games match) ──
export const palette = {
  bg: "#2b1a5e",
  board: "#45348c",
  cream: "#fff8ec",
  marigold: "#ff9f1c",
  pink: "#ef476f",
  teal: "#06d6a0",
  sky: "#4cc9f0",
  ink: "#241f3d",
  pieces: ["#ff9f1c", "#ef476f", "#06d6a0", "#4cc9f0", "#c77dff", "#ffd166", "#f7717d", "#83e377"],
};

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}
