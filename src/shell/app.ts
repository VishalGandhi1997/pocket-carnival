import { games, type GameDef, type GameMode } from "../games/registry";
import { sdk } from "../sdk/platform";
import { showHowTo } from "../engine/ui";
import { confetti, flyCoins } from "../engine/fx";
import { adsAreNative } from "../sdk/ads";
import { PRODUCTS, purchase, loadStorePrices, type Product } from "../sdk/billing";
import { fetchTop } from "../sdk/leaderboard";
import { skinsFor, type SkinCategory } from "../sdk/cosmetics";
import { ECONOMY } from "../sdk/economy";

const root = document.getElementById("app")!;
let cleanupGame: (() => void) | null = null;
let offWallet: (() => void) | null = null;
let booted = false;

/** Escape user-provided text before putting it in innerHTML (e.g. player name). */
function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// Every button in the app clicks audibly — one listener, zero per-button code.
root.addEventListener(
  "click",
  (e) => {
    if ((e.target as HTMLElement).closest("button")) sdk.sfx("click");
  },
  { capture: true },
);

/** Slide-up + whoosh on every view change (not on first paint). */
function transitionIn() {
  root.classList.remove("screen-in");
  void root.offsetWidth; // restart the CSS animation
  root.classList.add("screen-in");
  if (booted) sdk.sfx("whoosh");
  booted = true;
}

/** Ambient parallax: faint game glyphs drifting behind everything. */
function ensureBgGlyphs() {
  if (document.querySelector(".bg-glyphs")) return;
  const wrap = document.createElement("div");
  wrap.className = "bg-glyphs";
  const glyphs = ["🎲", "🧩", "🎯", "🪁", "⭐", "🎪", "🃏", "⚽"];
  glyphs.forEach((g, i) => {
    const s = document.createElement("span");
    s.textContent = g;
    s.style.left = `${(i * 13 + 4) % 88}%`;
    s.style.top = `${(i * 31 + 6) % 90}%`;
    s.style.animationDelay = `${i * -2.3}s`;
    s.style.animationDuration = `${11 + (i % 5) * 3}s`;
    s.style.fontSize = `${34 + (i % 4) * 13}px`;
    wrap.appendChild(s);
  });
  document.body.appendChild(wrap);
}

/**
 * Persistent bottom banner slot. On a real device the native AdMob banner
 * renders over this strip; in the browser/web build it shows a labeled
 * placeholder so the layout reserves the space and looks like a real ads app.
 * Hidden entirely for players who bought Remove Ads.
 */
function ensureAdBanner() {
  if (sdk.hasRemoveAds()) {
    removeAdBanner();
    return;
  }
  if (document.querySelector(".ad-banner")) return;
  document.body.classList.add("has-banner");
  const bar = document.createElement("div");
  bar.className = "ad-banner";
  if (adsAreNative) {
    // Native AdMob banner draws on top of this strip; keep it empty.
    bar.classList.add("native");
  } else {
    bar.innerHTML = `
      <span class="ad-tag">AD</span>
      <span class="ad-fake">Banner ad · AdMob renders here on Android</span>
    `;
  }
  document.body.appendChild(bar);
}

/** In-feed native ad slot. Browser: labeled placeholder card; device: a real
 *  AdMob native/MREC unit renders into this container. Skipped for ad-free. */
function renderNativeAd() {
  if (sdk.hasRemoveAds()) return;
  const el = document.createElement("div");
  el.className = "ad-native";
  el.setAttribute("aria-label", "Advertisement");
  el.innerHTML = `
    <span class="ad-tag">AD</span>
    <div class="ad-thumb">🛍️</div>
    <div class="ad-lines"><div class="ad-line"></div><div class="ad-line short"></div></div>
    <span class="ad-cta">Install</span>
  `;
  root.appendChild(el);
}

/** Remove the bottom banner slot + reserved space (after buying Remove Ads). */
function removeAdBanner() {
  document.querySelector(".ad-banner")?.remove();
  document.body.classList.remove("has-banner");
}

function showProfileSheet() {
  const p = sdk.getProfile();
  if (!p) return;
  const ov = document.createElement("div");
  ov.className = "howto-overlay";
  ov.innerHTML = `
    <div class="howto-card profile-sheet">
      <div class="ps-avatar">${p.avatar}</div>
      <div class="howto-title">${esc(p.name)}</div>
      <div class="ps-status">👤 Playing as guest · saved on this device</div>
      <div class="ps-row"><span>🪙 Coins</span><b>${sdk.getCoins()}</b></div>
      <div class="ps-about">
        <span class="ps-brand">A <b>BetterSuite</b> app</span>
        <span class="ps-links">
          <a href="https://bettersuite.app/pocketcarnival/privacy/" target="_blank" rel="noopener">Privacy</a> ·
          <a href="https://bettersuite.app/terms/" target="_blank" rel="noopener">Terms</a> ·
          <a href="https://bettersuite.app/pocketcarnival/support/" target="_blank" rel="noopener">Support</a>
        </span>
      </div>
    </div>
  `;
  const card = ov.querySelector(".howto-card")!;

  const close = document.createElement("button");
  close.className = "btn-primary";
  close.textContent = "Close";
  close.addEventListener("click", () => ov.remove());
  card.appendChild(close);

  // Data deletion — required by Google Play's user-data policy.
  const del = document.createElement("button");
  del.className = "btn-ghost ps-delete";
  del.textContent = "Delete my data";
  del.addEventListener("click", () => confirmDeleteData(ov));
  card.appendChild(del);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.remove();
  });
  document.body.appendChild(ov);
}

/** Two-step confirm before wiping all local data (irreversible). */
function confirmDeleteData(parent: HTMLElement) {
  const ov = document.createElement("div");
  ov.className = "howto-overlay";
  ov.innerHTML = `
    <div class="howto-card profile-sheet">
      <div class="ps-avatar">⚠️</div>
      <div class="howto-title">Delete all data?</div>
      <div class="ps-status">This permanently erases your coins, scores, levels and skins on this device. This can't be undone.</div>
    </div>`;
  const card = ov.querySelector(".howto-card")!;
  const yes = document.createElement("button");
  yes.className = "btn-ghost ps-delete";
  yes.textContent = "Yes, delete everything";
  yes.addEventListener("click", () => {
    sdk.deleteAllData();
    ov.remove();
    parent.remove();
    showWelcome(); // back to a clean first-run state
  });
  const no = document.createElement("button");
  no.className = "btn-primary";
  no.textContent = "Keep my data";
  no.addEventListener("click", () => ov.remove());
  card.append(no, yes);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.remove();
  });
  document.body.appendChild(ov);
}

/** Generic modal shell (dimmed backdrop + card). Returns the card element. */
function openModal(): { ov: HTMLElement; card: HTMLElement } {
  const ov = document.createElement("div");
  ov.className = "howto-overlay";
  const card = document.createElement("div");
  card.className = "howto-card sheet-card";
  ov.appendChild(card);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.remove();
  });
  document.body.appendChild(ov);
  return { ov, card };
}

function modalClose(card: HTMLElement, ov: HTMLElement) {
  const close = document.createElement("button");
  close.className = "btn-ghost";
  close.textContent = "Close";
  close.addEventListener("click", () => ov.remove());
  card.appendChild(close);
}

// ── Daily missions modal ──
function showMissions() {
  const { ov, card } = openModal();
  const draw = () => {
    const missions = sdk.getMissions();
    card.innerHTML = `
      <div class="howto-emoji">🎯</div>
      <div class="howto-title">Daily Missions</div>
      <div class="ms-note">Resets every day · complete for bonus coins</div>
      <div class="ms-list">
        ${missions
          .map((m) => {
            const pct = Math.round((m.progress / m.target) * 100);
            const state = m.claimed ? "claimed" : m.done ? "ready" : "active";
            return `
          <div class="ms-item ${state}" data-id="${m.id}">
            <span class="ms-ico">${m.icon}</span>
            <div class="ms-mid">
              <div class="ms-lbl">${m.label}</div>
              <div class="ms-bar"><span style="width:${pct}%"></span></div>
              <div class="ms-prog">${Math.min(m.progress, m.target)}/${m.target}</div>
            </div>
            <button class="ms-claim" ${m.done && !m.claimed ? "" : "disabled"}>
              ${m.claimed ? "✓" : `+${m.reward}`}
            </button>
          </div>`;
          })
          .join("")}
      </div>
    `;
    card.querySelectorAll<HTMLButtonElement>(".ms-item").forEach((item) => {
      const id = item.dataset.id as any;
      item.querySelector(".ms-claim")!.addEventListener("click", () => {
        const got = sdk.claimMission(id);
        if (got > 0) {
          confetti(item, 30);
          flyCoins(item, 5);
          draw();
        }
      });
    });
    modalClose(card, ov);
  };
  draw();
}

// ── Shop modal ──
async function showShop() {
  const { ov, card } = openModal();
  const owned = sdk.hasRemoveAds();
  // Loading state while we fetch localized store prices.
  card.innerHTML = `<div class="howto-emoji">🛒</div><div class="howto-title">Shop</div>
    <div class="ms-note">Loading prices…</div>`;
  // Localized store prices ($ / € / … per the user's store account). Empty in
  // the browser → falls back to each product's priceLabel.
  const storePrices = await loadStorePrices();
  if (!ov.isConnected) return; // modal closed while awaiting
  card.innerHTML = `
    <div class="howto-emoji">🛒</div>
    <div class="howto-title">Shop</div>
    <div class="ms-note">Prices shown in your local currency</div>
    <div class="shop-list"></div>
  `;
  const list = card.querySelector(".shop-list")!;
  for (const pr of PRODUCTS) {
    if (pr.removeAds && owned) continue;
    const row = document.createElement("button");
    row.className = "shop-item" + (pr.best ? " best" : "");
    row.innerHTML = `
      <span class="shop-ico">${pr.emoji}</span>
      <span class="shop-mid">
        <span class="shop-title">${pr.title}${pr.best ? ' <span class="shop-tag">BEST</span>' : ""}</span>
        <span class="shop-sub">${pr.coins ? `${pr.coins.toLocaleString()} coins` : "No more ads, ever"}</span>
      </span>
      <span class="shop-price">${storePrices[pr.id] ?? pr.priceLabel}</span>
    `;
    row.addEventListener("click", () => buy(pr, row));
    list.appendChild(row);
  }
  const disc = document.createElement("div");
  disc.className = "shop-disc";
  disc.textContent =
    "Coins are virtual items for in-game use only — no real-world value, non-refundable, and non-transferable.";
  card.appendChild(disc);
  modalClose(card, ov);

  async function buy(pr: Product, row: HTMLElement) {
    // Guard against rapid double-taps firing two purchases.
    if (row.dataset.busy === "1") return;
    row.dataset.busy = "1";
    (row as HTMLButtonElement).disabled = true;
    const priceEl = row.querySelector(".shop-price")!;
    const original = priceEl.textContent;
    priceEl.textContent = "…";
    const ok = await purchase(pr);
    if (!ok) {
      priceEl.textContent = original;
      row.dataset.busy = "";
      (row as HTMLButtonElement).disabled = false;
      return;
    }
    if (pr.removeAds) {
      sdk.grantRemoveAds();
      removeAdBanner(); // drop the bottom banner slot immediately
    }
    if (pr.coins) sdk.grantCoins(pr.coins, pr.id);
    confetti(row, 44);
    flyCoins(row, 8);
    setTimeout(() => {
      ov.remove();
      showShop();
    }, 600);
  }
}

// ── Weekly leaderboard modal (per game) ──
function showLeaderboard(gameId?: string) {
  const playable = games.filter((g) => g.mount);
  const gid = gameId ?? playable[0].id;
  const game = games.find((g) => g.id === gid)!;
  const p = sdk.getProfile();
  const rows = fetchTop(gid, {
    name: p?.name ?? "You",
    avatar: p?.avatar ?? "🙂",
    score: sdk.getBest(gid),
  });
  const { ov, card } = openModal();
  card.innerHTML = `
    <div class="howto-emoji">🏆</div>
    <div class="howto-title">Weekly Ranks</div>
    <div class="lb-picker"></div>
    <div class="lb-game">${game.emoji} ${game.title}</div>
    <div class="lb-list">
      ${rows
        .map(
          (r) => `
        <div class="lb-row ${r.you ? "you" : ""}">
          <span class="lb-rank ${r.rank <= 3 ? "top" : ""}">${r.rank}</span>
          <span class="lb-av">${r.avatar}</span>
          <span class="lb-name">${esc(r.name)}${r.you ? " (you)" : ""}</span>
          <span class="lb-score">${r.score.toLocaleString()}</span>
        </div>`,
        )
        .join("")}
    </div>
  `;
  const picker = card.querySelector(".lb-picker")!;
  for (const g of playable) {
    const chip = document.createElement("button");
    chip.className = "lb-chip" + (g.id === gid ? " sel" : "");
    chip.textContent = g.emoji;
    chip.title = g.title;
    chip.addEventListener("click", () => {
      ov.remove();
      showLeaderboard(g.id);
    });
    picker.appendChild(chip);
  }
  modalClose(card, ov);
}

// ── Skins modal (spend coins on cosmetics) ──
const SKIN_CATS: { key: SkinCategory; label: string }[] = [
  { key: "naagin", label: "🐍 Snake Skins" },
  { key: "blockbazi", label: "🧱 Board Themes" },
];

function showSkins() {
  const { ov, card } = openModal();
  const draw = () => {
    card.innerHTML = `<div class="howto-emoji">✨</div><div class="howto-title">Skins</div>
      <div class="ms-note">Spend coins to customise your games</div>`;
    for (const cat of SKIN_CATS) {
      const sec = document.createElement("div");
      sec.className = "skin-sec";
      sec.innerHTML = `<div class="skin-cat">${cat.label}</div><div class="skin-grid"></div>`;
      const grid = sec.querySelector(".skin-grid")!;
      for (const s of skinsFor(cat.key)) {
        const owned = sdk.ownsSkin(s.id);
        const equipped = sdk.getEquipped(cat.key) === s.id;
        const tile = document.createElement("button");
        tile.className = "skin-tile" + (equipped ? " equipped" : "");
        const swatch = s.colors.head ?? s.colors.zoneA ?? "#888";
        const swatch2 = s.colors.body ?? s.colors.zoneB ?? swatch;
        tile.innerHTML = `
          <span class="skin-swatch" style="background:linear-gradient(135deg,${swatch},${swatch2})">${s.emoji}</span>
          <span class="skin-name">${s.name}</span>
          <span class="skin-state">${
            equipped ? "✓ On" : owned ? "Equip" : `${s.cost} 🪙`
          }</span>`;
        tile.addEventListener("click", () => {
          if (equipped) return;
          if (owned) {
            sdk.equipSkin(cat.key, s.id);
            draw();
          } else if (sdk.buySkin(s.id)) {
            confetti(tile, 34);
            draw();
          } else {
            sdk.track("skin_cant_afford", { skin: s.id });
            tile.animate([{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 200 });
          }
        });
        grid.appendChild(tile);
      }
      card.appendChild(sec);
    }
    modalClose(card, ov);
  };
  draw();
}

// ── Lucky Spin wheel ──
// Prize table + cost come from the economy config; colours are cosmetic.
const SPIN_COLORS = ["#4cc9f0", "#2ee6a8", "#ff9f1c", "#ff5c8a", "#c77dff", "#ffd75e", "#43f0b8", "#8f79ff"];
const SPIN_PRIZES = ECONOMY.spin.prizes.map((p, i) => ({
  label: String(p.coins),
  coins: p.coins,
  weight: p.weight,
  color: SPIN_COLORS[i % SPIN_COLORS.length],
}));
const SPIN_COST = ECONOMY.spin.cost;

function showSpin() {
  const { ov, card } = openModal();
  let spinning = false;
  let rotation = 0;

  const seg = 360 / SPIN_PRIZES.length;
  const gradient = SPIN_PRIZES.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(",");

  const draw = () => {
    const free = sdk.canFreeSpin();
    card.innerHTML = `
      <div class="howto-title">🎡 Lucky Spin</div>
      <div class="ms-note">${free ? "You have a FREE spin today!" : `Spin again for ${SPIN_COST} 🪙`}</div>
      <div class="wheel-wrap">
        <div class="wheel-pointer">▼</div>
        <div class="wheel" style="background:conic-gradient(${gradient});transform:rotate(${rotation}deg)">
          ${SPIN_PRIZES.map((p, i) => `<span class="wheel-lbl" style="transform:rotate(${i * seg + seg / 2}deg)"><b style="transform:rotate(${-(i * seg + seg / 2)}deg)">${p.label}</b></span>`).join("")}
        </div>
      </div>
      <button class="btn-primary spin-go">${free ? "Free Spin 🎡" : `Spin · ${SPIN_COST} 🪙`}</button>
    `;
    const go = card.querySelector<HTMLButtonElement>(".spin-go")!;
    go.addEventListener("click", spin);
    modalClose(card, ov);
  };

  function spin() {
    if (spinning) return;
    const free = sdk.canFreeSpin();
    if (free) sdk.useFreeSpin();
    else if (!sdk.spendCoins(SPIN_COST)) {
      toastNeedCoins();
      return;
    }
    spinning = true;
    // weighted pick
    const total = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < SPIN_PRIZES.length; i++) {
      r -= SPIN_PRIZES[i].weight;
      if (r <= 0) { idx = i; break; }
    }
    const prize = SPIN_PRIZES[idx];
    const targetAngle = 360 * 5 + (360 - (idx * seg + seg / 2)); // land pointer (top) on segment
    rotation += targetAngle - (rotation % 360);
    const wheel = card.querySelector<HTMLElement>(".wheel")!;
    const go = card.querySelector<HTMLButtonElement>(".spin-go")!;
    go.disabled = true;
    wheel.style.transition = "transform 3.2s cubic-bezier(0.15, 0.9, 0.25, 1)";
    wheel.style.transform = `rotate(${rotation}deg)`;
    sdk.sfx("whoosh");
    setTimeout(() => {
      sdk.addCoins(prize.coins, "Lucky Spin");
      confetti(wheel, 60);
      flyCoins(wheel, 8);
      sdk.track("spin", { prize: prize.coins });
      spinning = false;
      draw();
    }, 3300);
  }

  draw();
}

function toastNeedCoins() {
  sdk.track("need_coins", {});
  showShop();
}

function muteButton(): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "btn-help";
  b.title = "Sound on/off";
  b.setAttribute("aria-label", "Toggle sound");
  b.textContent = sdk.isMuted() ? "🔇" : "🔊";
  b.addEventListener("click", () => {
    const m = sdk.toggleMute();
    b.textContent = m ? "🔇" : "🔊";
    b.setAttribute("aria-pressed", String(m));
  });
  return b;
}

const AVATARS = ["🦊", "🐯", "🦁", "🐼", "🐵", "🐸", "🦉", "🐧", "🦄", "🐙"];

/** First-run welcome. Guest-first: "Start Playing" needs zero input. Sign-in
 *  is optional and only matters for cross-device cloud sync (future Firebase). */
export function showWelcome() {
  teardown();
  ensureBgGlyphs();
  root.innerHTML = "";
  let chosen = AVATARS[0];

  const wrap = document.createElement("div");
  wrap.className = "welcome";
  wrap.innerHTML = `
    <div class="w-logo">Pocket<em>Carnival</em></div>
    <div class="w-sub">40 games, one app. Jump straight in.</div>
    <div class="w-avatars">
      ${AVATARS.map(
        (a, i) => `<button class="w-av${i === 0 ? " sel" : ""}" data-av="${a}">${a}</button>`,
      ).join("")}
    </div>
    <input class="w-name" maxlength="14" placeholder="Your name (optional)" aria-label="Your name (optional)" />
    <button class="w-start">Start Playing 🎮</button>
    <div class="w-note">No sign-up needed — jump straight in. Your progress is saved on this device.</div>
  `;
  // NOTE: real "Sign in with Google" for cross-device cloud save is a documented
  // follow-up (FIREBASE-SETUP.md). The button was removed rather than ship a
  // non-functional stub that falsely implies your progress is synced.
  root.appendChild(wrap);

  wrap.querySelectorAll<HTMLButtonElement>(".w-av").forEach((b) =>
    b.addEventListener("click", () => {
      wrap.querySelectorAll(".w-av").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel");
      chosen = b.dataset.av!;
    }),
  );
  const nameInput = wrap.querySelector<HTMLInputElement>(".w-name")!;

  wrap.querySelector(".w-start")!.addEventListener("click", () => {
    sdk.createProfile(nameInput.value, chosen, false);
    showHome();
  });
  transitionIn();
}

export function showHome() {
  teardown();
  ensureBgGlyphs();
  ensureAdBanner();
  root.innerHTML = "";

  const header = document.createElement("div");
  header.className = "header";
  const p = sdk.getProfile();
  header.innerHTML = `
    <div class="brand-row">
      <button class="avatar-chip" title="Profile" aria-label="Profile and settings">${p?.avatar ?? "🙂"}</button>
      <div class="brand">Pocket<em>Carnival</em></div>
    </div>
    <div class="header-right">
      <div class="wallet"><span class="coin-ico">🪙</span><span id="coin-count"></span></div>
    </div>
  `;
  header.querySelector(".header-right")!.prepend(muteButton());
  header.querySelector(".avatar-chip")!.addEventListener("click", showProfileSheet);
  root.appendChild(header);
  bindWallet();
  renderDaily();
  renderEarn();
  renderSpinCard();
  renderHub();

  const single = games.filter((g) => g.players === "single");
  const multi = games.filter((g) => g.players === "multi");
  renderSection("Solo Games", "🕹️", single);
  renderNativeAd(); // in-feed ad between the two sections
  renderSection("Play Together", "🤝", multi);

  const note = document.createElement("div");
  note.className = "footer-note";
  note.textContent = "Pocket Carnival v1.2 · 40 games · A BetterSuite app";
  root.appendChild(note);
  transitionIn();
}

/** Quick-action row: Missions · Ranks · Shop. */
function renderHub() {
  const row = document.createElement("div");
  row.className = "hub-row";
  const missionsDone = sdk.getMissions().filter((m) => m.done && !m.claimed).length;
  row.innerHTML = `
    <button class="hub-btn" data-act="missions">
      <span class="hub-ico">🎯</span><span class="hub-lbl">Missions</span>
      ${missionsDone ? `<span class="hub-badge">${missionsDone}</span>` : ""}
    </button>
    <button class="hub-btn" data-act="ranks"><span class="hub-ico">🏆</span><span class="hub-lbl">Ranks</span></button>
    <button class="hub-btn" data-act="skins"><span class="hub-ico">✨</span><span class="hub-lbl">Skins</span></button>
    <button class="hub-btn" data-act="shop"><span class="hub-ico">🛒</span><span class="hub-lbl">Shop</span></button>
  `;
  row.querySelector('[data-act="missions"]')!.addEventListener("click", showMissions);
  row.querySelector('[data-act="ranks"]')!.addEventListener("click", () => showLeaderboard());
  row.querySelector('[data-act="skins"]')!.addEventListener("click", showSkins);
  row.querySelector('[data-act="shop"]')!.addEventListener("click", showShop);
  root.appendChild(row);
}

function renderDaily() {
  const el = document.createElement("div");
  const claimable = sdk.canClaimDaily();
  const streak = sdk.getStreak();
  const streakLabel = streak > 0 ? `🔥 ${streak}-day streak` : "";
  el.className = "daily" + (claimable ? "" : " claimed");
  el.innerHTML = `
    <div class="d-emoji">🎁</div>
    <div class="d-body">
      <div class="d-title">Daily Bonus ${streakLabel ? `<span class="d-streak">${streakLabel}</span>` : ""}</div>
      <div class="d-sub">${claimable ? "Claim now — longer streaks pay more!" : "Claimed — come back tomorrow ✓"}</div>
    </div>
    <button class="d-claim">Claim</button>
  `;
  el.querySelector(".d-claim")!.addEventListener("click", (e) => {
    const { coins, streak: s } = sdk.claimDaily();
    if (coins <= 0) return;
    el.classList.add("claimed");
    el.querySelector(".d-title")!.innerHTML = `Daily Bonus <span class="d-streak">🔥 ${s}-day streak</span>`;
    el.querySelector(".d-sub")!.textContent = "Claimed — come back tomorrow ✓";
    confetti(e.target as HTMLElement, 36);
    flyCoins(e.target as HTMLElement, 6);
  });
  root.appendChild(el);
}

function renderEarn() {
  const el = document.createElement("div");
  el.className = "earn";
  const render = () => {
    const left = sdk.earnViewsLeftToday();
    const per = sdk.earnCoinsPerAd();
    el.classList.toggle("empty", left === 0);
    el.innerHTML = `
      <div class="earn-emoji">📺</div>
      <div class="earn-body">
        <div class="earn-title">Watch &amp; Earn</div>
        <div class="earn-sub">${
          left > 0
            ? `Watch a short ad, get +${per} 🪙 · <b>${left}</b> left today`
            : "You've earned the max for today — back tomorrow!"
        }</div>
      </div>
      <button class="earn-btn" ${left === 0 ? "disabled" : ""}>+${per} 🪙</button>
    `;
    const btn = el.querySelector<HTMLButtonElement>(".earn-btn")!;
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = "Loading…";
      const earned = await sdk.watchToEarn();
      if (earned > 0) {
        confetti(btn, 44);
        flyCoins(btn, 6);
      }
      render(); // refresh count + button state
    });
  };
  render();
  root.appendChild(el);
}

function renderSpinCard() {
  const el = document.createElement("div");
  const free = sdk.canFreeSpin();
  el.className = "spincard" + (free ? "" : " used");
  el.innerHTML = `
    <div class="spincard-emoji">🎡</div>
    <div class="spincard-body">
      <div class="spincard-title">Lucky Spin</div>
      <div class="spincard-sub">${free ? "Your free daily spin is ready!" : "Spin again for coins"}</div>
    </div>
    <button class="spincard-btn">${free ? "FREE" : "Spin"}</button>
  `;
  el.querySelector(".spincard-btn")!.addEventListener("click", showSpin);
  root.appendChild(el);
}

function renderSection(title: string, emoji: string, list: GameDef[]) {
  const playable = list.filter((g) => g.mount).length;
  const h = document.createElement("div");
  h.className = "section-title";
  h.innerHTML = `${emoji} ${title} <span class="count">${playable}/${list.length}</span>`;
  root.appendChild(h);

  const grid = document.createElement("div");
  grid.className = "game-grid";
  list.forEach((g, i) => {
    const card = document.createElement("button");
    card.className = `game-card c${i % 8}` + (g.mount ? "" : " locked");
    card.style.animationDelay = `${Math.min(i, 12) * 40}ms`;
    const best = sdk.getBest(g.id);
    const lvl = sdk.getLevel(g.id);
    card.innerHTML = `
      ${g.mount && lvl > 1 ? `<span class="g-lvl">LVL ${lvl}</span>` : ""}
      <span class="g-emoji">${g.emoji}</span>
      <span class="g-title">${g.title}</span>
      <span class="g-tag">${g.tagline}</span>
      ${best > 0 ? `<span class="g-best">★ Best ${best}</span>` : ""}
      ${g.mount ? "" : `<span class="g-soon">SOON</span>`}
    `;
    if (g.mount) card.addEventListener("click", () => showGame(g));
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

function showGame(g: GameDef) {
  teardown();
  root.innerHTML = "";

  const screen = document.createElement("div");
  screen.className = "game-screen";
  screen.innerHTML = `
    <div class="game-topbar">
      <button class="btn-back">‹ Back</button>
      <div class="game-name">${g.emoji} ${g.title}</div>
      ${g.howTo ? `<button class="btn-help" aria-label="How to play">?</button>` : ""}
      <div class="wallet"><span class="coin-ico">🪙</span><span id="coin-count"></span></div>
    </div>
    <div class="game-host"></div>
  `;
  root.appendChild(screen);
  bindWallet();

  screen.querySelector(".btn-back")!.addEventListener("click", showHome);
  const helpBtn = screen.querySelector<HTMLButtonElement>(".btn-help");
  if (helpBtn && g.howTo) {
    helpBtn.addEventListener("click", () => showHowTo(g.title, g.emoji, g.howTo!, () => {}));
  }

  const host = screen.querySelector<HTMLElement>(".game-host")!;

  const launch = (mode?: GameMode) => {
    host.innerHTML = "";
    cleanupGame = g.mount!(host, sdk, mode ? { mode } : undefined);
  };

  if (g.players === "multi") {
    showModeSelect(host, g, launch);
  } else {
    launch();
  }

  // First visit to any game: auto-open the how-to-play modal once.
  if (g.howTo && !sdk.hasSeenHowTo(g.id)) {
    sdk.markSeenHowTo(g.id);
    showHowTo(g.title, g.emoji, g.howTo, () => {});
  }
  transitionIn();
}

function showModeSelect(host: HTMLElement, g: GameDef, launch: (mode: GameMode) => void) {
  const sel = document.createElement("div");
  sel.className = "mode-select";
  sel.innerHTML = `
    <div class="m-emoji">${g.emoji}</div>
    <div class="m-title">${g.title}</div>
    <div class="m-sub">Choose how you want to play</div>
    <button class="mode-btn bot">
      <span class="m-btn-emoji">🤖</span>
      <span>
        <span class="m-btn-title" style="display:block">Play vs Bot</span>
        <span class="m-btn-sub">Practice solo against the computer</span>
      </span>
    </button>
    <button class="mode-btn pnp">
      <span class="m-btn-emoji">🤝</span>
      <span>
        <span class="m-btn-title" style="display:block">Pass & Play</span>
        <span class="m-btn-sub">Two players, one device — take turns</span>
      </span>
    </button>
  `;
  sel.querySelector(".bot")!.addEventListener("click", () => launch("bot"));
  sel.querySelector(".pnp")!.addEventListener("click", () => launch("pnp"));
  host.appendChild(sel);
}

function bindWallet() {
  const el = document.getElementById("coin-count");
  if (!el) return;
  el.textContent = String(sdk.getCoins());
  offWallet = sdk.onWalletChange(() => {
    el.textContent = String(sdk.getCoins());
    // bump the pill so earnings register in the corner of your eye
    const pill = el.closest(".wallet");
    if (pill) {
      pill.classList.remove("bump");
      void (pill as HTMLElement).offsetWidth;
      pill.classList.add("bump");
    }
  });
}

function teardown() {
  cleanupGame?.();
  cleanupGame = null;
  offWallet?.();
  offWallet = null;
}
