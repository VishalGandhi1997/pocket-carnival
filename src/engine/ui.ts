// Shared DOM chrome used by every mini-game: score HUD above the canvas
// and the brand-standard end-of-round overlay (same template everywhere).

import { sdk, toast } from "../sdk/platform";
import { confetti, flyCoins, shake } from "./fx";

export interface Hud {
  el: HTMLElement;
  set(label: string, value: string | number): void;
}

export function makeHud(host: HTMLElement, fields: string[]): Hud {
  const el = document.createElement("div");
  el.className = "hud";
  const spans = new Map<string, HTMLElement>();
  for (const f of fields) {
    const box = document.createElement("div");
    box.innerHTML = `${f} <span class="hud-val">0</span>`;
    spans.set(f, box.querySelector(".hud-val")!);
    el.appendChild(box);
  }
  host.appendChild(el);
  return {
    el,
    set(label, value) {
      const s = spans.get(label);
      if (!s) return;
      const next = String(value);
      if (s.textContent !== next) {
        s.textContent = next;
        // value changed → pop the number
        s.classList.remove("pop-val");
        void s.offsetWidth; // restart animation
        s.classList.add("pop-val");
      }
    },
  };
}

export interface OverlayOpts {
  title: string;
  subtitle?: string;
  coins?: number;
  isBest?: boolean;
  /** "win" (default) = fanfare + confetti; "lose" = womp + shake. */
  mood?: "win" | "lose";
  primaryLabel: string;
  onPrimary: () => void;
}

/** Shows the standard win/lose overlay inside the canvas wrapper. */
export function showOverlay(canvas: HTMLCanvasElement, opts: OverlayOpts): HTMLElement {
  // A late bot/dice timer can fire this after the player navigated away and the
  // canvas was detached — bail out instead of throwing on a null parent.
  const wrap = canvas.parentElement;
  if (!wrap) return document.createElement("div");
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <h2>${opts.title}</h2>
    ${opts.isBest ? `<div class="ov-sub">🏆 New best!</div>` : ""}
    ${opts.subtitle ? `<div class="ov-sub">${opts.subtitle}</div>` : ""}
    ${opts.coins ? `<div class="ov-coins">+${opts.coins} 🪙 earned</div>` : ""}
  `;
  // Results-screen ad slot — a medium rectangle (MREC). Highest-eCPM
  // incremental placement in casual games. Hidden for Remove-Ads buyers.
  // Browser shows a placeholder; on device this hosts a real AdMob MREC.
  if (!sdk.hasRemoveAds()) {
    const adSlot = document.createElement("div");
    adSlot.className = "ov-ad";
    adSlot.innerHTML = `<span class="ad-tag">AD</span><span class="ad-fake">Result-screen ad (MREC)</span>`;
    ov.appendChild(adSlot);
  }
  // Rewarded "2× coins" — the top-converting ad placement in casual games.
  // Only offered when coins were earned this round, and only once.
  if (opts.coins && opts.coins > 0) {
    const rw = document.createElement("button");
    rw.className = "btn-reward";
    rw.innerHTML = `🎬 Double it — +${opts.coins} 🪙`;
    rw.addEventListener("click", async () => {
      rw.disabled = true;
      rw.textContent = "Loading ad…";
      const ok = await sdk.watchRewarded(opts.coins!, "2× reward");
      rw.textContent = ok ? "✓ Doubled!" : "Ad unavailable";
      rw.classList.add("done");
      if (ok) {
        confetti(rw, 40);
        flyCoins(rw, 6);
      }
    });
    ov.appendChild(rw);
  }

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = opts.primaryLabel;
  btn.addEventListener("click", () => {
    ov.remove();
    // A round just finished; this is the natural ad break between rounds.
    sdk.roundEnded();
    opts.onPrimary();
  });
  ov.appendChild(btn);
  wrap.appendChild(ov);

  // ── The celebration moment ──
  const mood = opts.mood ?? "win";
  if (mood === "win") {
    sdk.sfx("win");
    confetti(wrap);
    const pill = ov.querySelector(".ov-coins");
    if (pill && opts.coins) setTimeout(() => flyCoins(pill, Math.min(8, opts.coins!)), 380);
  } else {
    sdk.sfx("lose");
    shake(wrap);
  }
  return ov;
}

// ── How to Play ── shared tutorial modal, one line per game to author.
export interface HowToStep {
  icon: string;
  text: string;
}

export function showHowTo(
  title: string,
  emoji: string,
  steps: HowToStep[],
  onClose: () => void,
): void {
  const ov = document.createElement("div");
  ov.className = "howto-overlay";
  ov.innerHTML = `
    <div class="howto-card">
      <div class="howto-emoji">${emoji}</div>
      <div class="howto-title">${title}</div>
      <div class="howto-steps">
        ${steps
          .map(
            (s) => `
          <div class="howto-step">
            <span class="howto-icon">${s.icon}</span>
            <span class="howto-text">${s.text}</span>
          </div>`,
          )
          .join("")}
      </div>
    </div>
  `;
  const btn = document.createElement("button");
  btn.className = "btn-primary howto-close";
  btn.textContent = "Got it, let's play! 🎮";
  btn.addEventListener("click", () => {
    ov.classList.add("closing");
    setTimeout(() => ov.remove(), 150);
    onClose();
  });
  ov.querySelector(".howto-card")!.appendChild(btn);
  document.body.appendChild(ov);
}

// ── Revive prompt ── shown on game-over before the results screen. Spend
// coins OR watch an ad to continue and keep your score.
export interface ReviveOpts {
  coinCost: number;
  adAvailable: boolean;
  onReviveCoins: () => void; // caller checks affordability + spends
  onReviveAd: () => Promise<boolean>; // resolves true if the ad was watched
  onDecline: () => void; // show the normal results overlay
}

export function showRevive(canvas: HTMLCanvasElement, opts: ReviveOpts) {
  const wrap = canvas.parentElement;
  if (!wrap) return opts.onDecline(); // canvas detached (navigated away) → just end
  const ov = document.createElement("div");
  ov.className = "overlay revive";
  const canAfford = sdk.getCoins() >= opts.coinCost;
  ov.innerHTML = `
    <h2>Continue?</h2>
    <div class="ov-sub">Keep your score — get back in the game</div>
  `;

  const coinBtn = document.createElement("button");
  coinBtn.className = "btn-primary";
  coinBtn.innerHTML = `▶ Continue · ${opts.coinCost} 🪙`;
  coinBtn.disabled = !canAfford;
  coinBtn.addEventListener("click", () => {
    ov.remove();
    opts.onReviveCoins();
  });
  ov.appendChild(coinBtn);

  if (opts.adAvailable) {
    const adBtn = document.createElement("button");
    adBtn.className = "btn-reward";
    adBtn.innerHTML = "🎬 Watch ad to continue";
    adBtn.addEventListener("click", async () => {
      adBtn.disabled = true;
      adBtn.textContent = "Loading ad…";
      const ok = await opts.onReviveAd();
      if (ok) ov.remove();
      else {
        adBtn.disabled = false;
        adBtn.textContent = "🎬 Watch ad to continue";
      }
    });
    ov.appendChild(adBtn);
  }

  const no = document.createElement("button");
  no.className = "btn-ghost";
  no.textContent = "No thanks";
  no.addEventListener("click", () => {
    ov.remove();
    opts.onDecline();
  });
  ov.appendChild(no);

  wrap.appendChild(ov);
  sdk.sfx("lose");
}

// ── Booster bar ── a row of coin-priced power-up buttons for a game.
export interface Booster {
  icon: string;
  label: string;
  cost: number;
  onUse: () => void; // called after coins are successfully spent
}

export function makeBoosterBar(host: HTMLElement, boosters: Booster[]): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "booster-bar";
  for (const b of boosters) {
    const btn = document.createElement("button");
    btn.className = "booster-btn";
    btn.innerHTML = `<span class="b-ico">${b.icon}</span><span class="b-lbl">${b.label}</span><span class="b-cost">${b.cost} 🪙</span>`;
    btn.addEventListener("click", () => {
      if (sdk.spendCoins(b.cost)) {
        b.onUse();
        btn.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
          { duration: 220 },
        );
      } else {
        toastNeedCoins();
      }
    });
    bar.appendChild(btn);
  }
  host.appendChild(bar);
  return bar;
}

function toastNeedCoins() {
  toast("Not enough coins — visit the Shop 🛒");
}

/** Small pill above the board showing whose turn it is. */
export interface TurnBanner {
  el: HTMLElement;
  set(text: string, tone?: "you" | "opp" | "neutral"): void;
}

export function makeTurnBanner(host: HTMLElement): TurnBanner {
  const el = document.createElement("div");
  el.className = "turn-banner";
  host.appendChild(el);
  return {
    el,
    set(text, tone = "neutral") {
      el.textContent = text;
      el.className = `turn-banner tone-${tone}`;
    },
  };
}
