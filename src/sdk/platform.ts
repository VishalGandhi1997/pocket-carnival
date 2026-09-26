// Pocket Carnival platform SDK — the single bridge every mini-game talks to.
// Backed by localStorage today; the same interface later routes to
// Firebase (wallet, leaderboards) and native ads/IAP via Capacitor.

import {
  initAds,
  showInterstitial,
  showRewarded,
  showBanner,
  hideBanner,
  showAppOpen,
} from "./ads";
import { play, setMuted, isMuted, type SfxName } from "../engine/sfx";
import { track } from "./analytics";
import { getSkin, DEFAULT_SKIN, type SkinCategory } from "./cosmetics";
import { ECONOMY } from "./economy";

const LS_KEY = "pocketcarnival.v1";
// Pre-rename save key; read once so existing progress carries over.
const LEGACY_LS_KEY = "khelmela.v1";

// Staged ad rollout (verified retention playbook): no interstitials for a
// new player's first few rounds, then one every Nth round-end. Tune freely.
const ADS_FREE_ROUNDS = 3;
const INTERSTITIAL_EVERY = 2;

// "Watch & Earn" free-coins economy: reward + daily cap so it drives repeat
// ad views without being infinitely farmable. (Values in economy.ts.)
const EARN_COINS_PER_AD = ECONOMY.watchEarn.coinsPerAd;
const EARN_MAX_PER_DAY = ECONOMY.watchEarn.maxPerDay;

export interface Profile {
  name: string;
  avatar: string; // emoji
  signedIn: boolean; // true once linked to an account (cloud sync)
}

// ── Daily missions ── central, trackable without touching individual games.
export type MissionType = "play_games" | "earn_coins" | "watch_ads" | "distinct_games";
interface MissionDef {
  type: MissionType;
  icon: string;
  label: (t: number) => string;
  target: number;
  reward: number;
}
const MISSION_POOL: MissionDef[] = [
  { type: "play_games", icon: "🎮", label: (t) => `Play ${t} games`, target: 4, reward: ECONOMY.missions.play_games },
  { type: "earn_coins", icon: "🪙", label: (t) => `Earn ${t} coins`, target: 80, reward: ECONOMY.missions.earn_coins },
  { type: "watch_ads", icon: "📺", label: (t) => `Watch ${t} ads`, target: 2, reward: ECONOMY.missions.watch_ads },
  { type: "distinct_games", icon: "🎲", label: (t) => `Play ${t} different games`, target: 3, reward: ECONOMY.missions.distinct_games },
];

export interface Mission {
  id: MissionType;
  icon: string;
  label: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
  done: boolean;
}

interface MissionState {
  date: string;
  ids: MissionType[]; // which 3 missions today
  progress: Partial<Record<MissionType, number>>;
  claimed: MissionType[];
  distinctGames: string[]; // gameIds played today (for distinct_games)
}

interface SaveState {
  coins: number;
  best: Record<string, number>;
  plays: Record<string, number>;
  levels?: Record<string, number>; // per-game difficulty level (1-based)
  lastDaily?: string;
  streak?: number;
  seenHowTo?: Record<string, boolean>;
  muted?: boolean;
  earnDate?: string; // day the earn-counter belongs to
  earnCount?: number; // rewarded "free coin" views used today
  profile?: Profile;
  removeAds?: boolean; // bought the remove-ads pack
  missions?: MissionState;
  owned?: string[]; // purchased skin ids
  equipped?: Partial<Record<SkinCategory, string>>;
  lastFreeSpin?: string; // day the free spin was used
}

function load(): SaveState {
  const defaults: SaveState = { coins: ECONOMY.startingCoins, best: {}, plays: {} };
  try {
    const raw = localStorage.getItem(LS_KEY) ?? localStorage.getItem(LEGACY_LS_KEY);
    if (raw) {
      // Merge over defaults so a partial/old-version/corrupt save can never
      // leave required fields (coins/best/plays) undefined.
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      return {
        ...defaults,
        ...parsed,
        coins: typeof parsed.coins === "number" && isFinite(parsed.coins) ? parsed.coins : defaults.coins,
        best: parsed.best ?? {},
        plays: parsed.plays ?? {},
      };
    }
  } catch {
    /* corrupted or unavailable storage → fresh state */
  }
  return defaults;
}

let state = load();
let totalRounds = 0; // this-session round counter, drives ad frequency
setMuted(!!state.muted); // restore sound preference

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* private mode etc. — play session still works in memory */
  }
}

type Listener = () => void;
const walletListeners = new Set<Listener>();

const today = () => new Date().toDateString();
const yesterday = () => new Date(Date.now() - 86400000).toDateString();

// Deterministically pick today's 3 missions from the pool (stable per day).
function pickMissionIds(dateStr: string): MissionType[] {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  // Unsigned shifts — signed >> can go negative for large hashes and index OOB.
  const idx = [h % 4, (h >>> 3) % 4, (h >>> 6) % 4];
  const ids: MissionType[] = [];
  for (const i of idx) {
    const t = MISSION_POOL[i].type;
    if (!ids.includes(t)) ids.push(t);
  }
  // ensure exactly 3 distinct missions
  for (const m of MISSION_POOL) if (ids.length < 3 && !ids.includes(m.type)) ids.push(m.type);
  return ids.slice(0, 3);
}

function ensureMissions(): MissionState {
  if (!state.missions || state.missions.date !== today()) {
    state.missions = {
      date: today(),
      ids: pickMissionIds(today()),
      progress: {},
      claimed: [],
      distinctGames: [],
    };
    persist();
  }
  return state.missions;
}

function bumpMission(type: MissionType, amount: number) {
  const m = ensureMissions();
  if (!m.ids.includes(type)) return;
  m.progress[type] = (m.progress[type] ?? 0) + amount;
  persist();
}

export const sdk = {
  getCoins(): number {
    return state.coins;
  },

  addCoins(n: number, reason?: string) {
    if (n <= 0) return;
    state.coins += Math.floor(n);
    // Mission credit only for gameplay/ad earnings, not shop/mission payouts.
    if (reason !== "Shop" && reason !== "Mission") bumpMission("earn_coins", Math.floor(n));
    persist();
    walletListeners.forEach((fn) => fn());
    toast(`+${Math.floor(n)} 🪙${reason ? " · " + reason : ""}`);
  },

  spendCoins(n: number): boolean {
    if (state.coins < n) return false;
    state.coins -= n;
    persist();
    walletListeners.forEach((fn) => fn());
    return true;
  },

  onWalletChange(fn: Listener): () => void {
    walletListeners.add(fn);
    return () => walletListeners.delete(fn);
  },

  getBest(gameId: string): number {
    return state.best[gameId] ?? 0;
  },

  // ── Profile / identity (guest-first, optional sign-in) ──

  getProfile(): Profile | null {
    return state.profile ?? null;
  },

  hasProfile(): boolean {
    return !!state.profile;
  },

  createProfile(name: string, avatar: string, signedIn = false) {
    state.profile = { name: name.trim() || "Player", avatar, signedIn };
    persist();
  },

  markSignedIn() {
    if (state.profile) {
      state.profile.signedIn = true;
      persist();
    }
  },

  /** Erase ALL local data (profile, coins, progress, skins). Required by
   *  Google Play's data-deletion policy. On device, also delete the cloud
   *  record before calling this (see FIREBASE-SETUP.md). */
  deleteAllData() {
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
      /* ignore */
    }
    state = { coins: ECONOMY.startingCoins, best: {}, plays: {} };
    track("account_deleted", {});
  },

  // ── Progressive difficulty (per-game level, 1-based) ──

  getLevel(gameId: string): number {
    return state.levels?.[gameId] ?? 1;
  },

  setLevel(gameId: string, level: number) {
    state.levels = state.levels ?? {};
    state.levels[gameId] = Math.max(1, level);
    persist();
  },

  /** Coin reward scaled by level — higher level = better payout, so climbing
   *  the difficulty is worth coming back for. */
  scaleReward(base: number, level: number): number {
    return Math.round(base * (1 + (level - 1) * ECONOMY.reward.perLevelBonus));
  },

  /** Returns true if this is a new best score. Also drives play missions,
   *  analytics, and the weekly leaderboard. Call once per finished round. */
  submitScore(gameId: string, score: number): boolean {
    state.plays[gameId] = (state.plays[gameId] ?? 0) + 1;
    const isBest = score > (state.best[gameId] ?? 0);
    if (isBest) state.best[gameId] = score;
    // Mission progress: total games + distinct games today.
    bumpMission("play_games", 1);
    const m = ensureMissions();
    if (!m.distinctGames.includes(gameId)) {
      m.distinctGames.push(gameId);
      m.progress["distinct_games"] = m.distinctGames.length;
    }
    persist();
    track("game_over", { game: gameId, score, best: isBest });
    return isBest;
  },

  canClaimDaily(): boolean {
    return state.lastDaily !== today();
  },

  getStreak(): number {
    return state.streak ?? 0;
  },

  /** Daily reward that grows with a consecutive-day streak (capped). */
  claimDaily(): { coins: number; streak: number } {
    if (!this.canClaimDaily()) return { coins: 0, streak: state.streak ?? 0 };
    // continue the streak if yesterday was claimed, else restart at 1
    state.streak = state.lastDaily === yesterday() ? (state.streak ?? 0) + 1 : 1;
    state.lastDaily = today();
    const d = ECONOMY.daily;
    const coins = d.base + Math.min(state.streak, d.streakCap) * d.perStreakDay; // day1→day7+
    persist();
    this.addCoins(coins, "Daily bonus");
    track("daily_claim", { streak: state.streak, coins });
    return { coins, streak: state.streak };
  },

  hasSeenHowTo(gameId: string): boolean {
    return !!state.seenHowTo?.[gameId];
  },

  markSeenHowTo(gameId: string) {
    state.seenHowTo = state.seenHowTo ?? {};
    state.seenHowTo[gameId] = true;
    persist();
  },

  /**
   * Gameplay feedback tick: vibration + a matching synthesized sound, so
   * every game gets audio for free at its existing haptic points.
   * Small ms = soft tick, larger ms = chunkier pop.
   */
  haptic(ms = 15) {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
    play(ms >= 25 ? "pop" : "tick");
  },

  /** Play a named brand sound (see engine/sfx.ts). */
  sfx(name: SfxName) {
    play(name);
  },

  isMuted(): boolean {
    return isMuted();
  },

  toggleMute(): boolean {
    state.muted = !state.muted;
    setMuted(!!state.muted);
    persist();
    return !!state.muted;
  },

  // ── Ads (real AdMob on Android, no-op in browser) ──

  /** Call once at startup: init AdMob, request consent, show a banner + app-open ad.
   *  Forced ads are suppressed for players who bought Remove Ads. */
  initAds() {
    void initAds().then(() => {
      if (state.removeAds) return;
      void showBanner();
      void showAppOpen();
    });
  },

  showBanner() {
    void showBanner();
  },
  hideBanner() {
    void hideBanner();
  },

  /**
   * Show a rewarded video and grant `coins` if the user watched it fully.
   * Returns true if rewarded. In the browser it grants instantly so the
   * reward path is testable without a device.
   */
  async watchRewarded(coins: number, reason = "Reward"): Promise<boolean> {
    const earned = await showRewarded();
    if (earned) {
      this.addCoins(coins, reason);
      bumpMission("watch_ads", 1);
      track("rewarded_watched", { reason, coins });
    }
    return earned;
  },

  /**
   * Call at the end of a round. Shows an interstitial only after the player's
   * ad-free grace rounds, then once every few rounds. Skipped for Remove-Ads
   * buyers. Fire-and-forget.
   */
  roundEnded() {
    if (state.removeAds) return;
    totalRounds++;
    if (totalRounds <= ADS_FREE_ROUNDS) return;
    if ((totalRounds - ADS_FREE_ROUNDS) % INTERSTITIAL_EVERY === 0) void showInterstitial();
  },

  // ── Watch & Earn (rewarded video → coins), with a daily cap ──

  earnCoinsPerAd(): number {
    return EARN_COINS_PER_AD;
  },

  earnViewsLeftToday(): number {
    const today = new Date().toDateString();
    if (state.earnDate !== today) return EARN_MAX_PER_DAY;
    return Math.max(0, EARN_MAX_PER_DAY - (state.earnCount ?? 0));
  },

  earnMaxPerDay(): number {
    return EARN_MAX_PER_DAY;
  },

  /**
   * Play a rewarded video to earn free coins. Returns coins granted (0 if the
   * daily cap is hit or the ad wasn't completed). In the browser the ad path
   * resolves instantly so the flow is testable.
   */
  async watchToEarn(): Promise<number> {
    const today = new Date().toDateString();
    if (state.earnDate !== today) {
      state.earnDate = today;
      state.earnCount = 0;
    }
    if ((state.earnCount ?? 0) >= EARN_MAX_PER_DAY) return 0;
    const watched = await showRewarded();
    if (!watched) return 0;
    state.earnCount = (state.earnCount ?? 0) + 1;
    persist();
    this.addCoins(EARN_COINS_PER_AD, "Watch & Earn");
    bumpMission("watch_ads", 1);
    track("rewarded_watched", { reason: "watch_and_earn", coins: EARN_COINS_PER_AD });
    return EARN_COINS_PER_AD;
  },

  // ── Daily missions ──

  getMissions(): Mission[] {
    const m = ensureMissions();
    return m.ids.map((id) => {
      const def = MISSION_POOL.find((d) => d.type === id)!;
      const progress = Math.min(m.progress[id] ?? 0, def.target);
      return {
        id,
        icon: def.icon,
        label: def.label(def.target),
        target: def.target,
        progress,
        reward: def.reward,
        claimed: m.claimed.includes(id),
        done: progress >= def.target,
      };
    });
  },

  /** Claim a completed mission's reward. Returns coins granted (0 if not claimable). */
  claimMission(id: MissionType): number {
    const m = ensureMissions();
    const def = MISSION_POOL.find((d) => d.type === id);
    if (!def || m.claimed.includes(id)) return 0;
    if ((m.progress[id] ?? 0) < def.target) return 0;
    m.claimed.push(id);
    persist();
    this.addCoins(def.reward, "Mission");
    track("mission_claim", { mission: id, reward: def.reward });
    return def.reward;
  },

  // ── Shop / purchases (Remove Ads + coin packs) ──

  hasRemoveAds(): boolean {
    return !!state.removeAds;
  },

  /** Grant Remove Ads (call after a successful Play Billing purchase / restore). */
  grantRemoveAds() {
    state.removeAds = true;
    persist();
    hideBanner();
    track("purchase", { product: "remove_ads" });
  },

  /** Grant a coin pack (call after a successful purchase). */
  grantCoins(amount: number, productId: string) {
    this.addCoins(amount, "Shop");
    track("purchase", { product: productId, coins: amount });
  },

  // ── Raw rewarded ad (no coin grant) — used by Revive ──
  async watchAd(): Promise<boolean> {
    const ok = await showRewarded();
    if (ok) {
      bumpMission("watch_ads", 1); // revive ads count toward the watch-ads mission
      track("rewarded_watched", { reason: "revive" });
    }
    return ok;
  },

  // ── Cosmetic skins (the coin sink) ──

  ownsSkin(id: string): boolean {
    const skin = getSkin(id);
    if (!skin) return false;
    return skin.cost === 0 || !!state.owned?.includes(id);
  },

  buySkin(id: string): boolean {
    const skin = getSkin(id);
    if (!skin || this.ownsSkin(id)) return false;
    if (!this.spendCoins(skin.cost)) return false;
    state.owned = state.owned ?? [];
    state.owned.push(id);
    this.equipSkin(skin.category, id);
    track("skin_buy", { skin: id, cost: skin.cost });
    return true;
  },

  equipSkin(category: SkinCategory, id: string) {
    if (!this.ownsSkin(id)) return;
    state.equipped = state.equipped ?? {};
    state.equipped[category] = id;
    persist();
  },

  getEquipped(category: SkinCategory): string {
    return state.equipped?.[category] ?? DEFAULT_SKIN[category];
  },

  /** Colour data for the currently-equipped skin in a category. */
  skinColors(category: SkinCategory): Record<string, string> {
    return getSkin(this.getEquipped(category))?.colors ?? {};
  },

  // ── Lucky Spin ──

  canFreeSpin(): boolean {
    return state.lastFreeSpin !== new Date().toDateString();
  },

  useFreeSpin() {
    state.lastFreeSpin = new Date().toDateString();
    persist();
  },

  // ── Analytics passthrough for the UI layer ──
  track,
};

export type Sdk = typeof sdk;

// ── Toast ──
let toastEl: HTMLDivElement | null = null;
let toastTimer: number | undefined;

export function toast(msg: string) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove("show"), 1800);
}
