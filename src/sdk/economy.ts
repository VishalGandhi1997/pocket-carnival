// ── Economy config: the single source of truth for every coin number ──
//
// Design goal (ads-first app): coins should always feel a little scarce so
// players keep watching rewarded ads (our revenue) and occasionally buy a
// coin pack. Every free coin needs a compelling place to go, or both the
// ad-watch AND the purchase incentive collapse.
//
// Target daily budget for an ENGAGED free player ≈ 350–400 coins:
//   daily bonus ~40 · watch&earn 150 (6×25) · missions ~90 · free spin ~60 · play ~60
// Sinks are priced against that budget (see ECONOMY.md for the full model).

export const ECONOMY = {
  startingCoins: 100,

  // ── Faucets ──
  daily: { base: 15, perStreakDay: 4, streakCap: 7 }, // day1 = 19 … day7+ = 43
  watchEarn: { coinsPerAd: 25, maxPerDay: 6 }, // 150/day; the ad-revenue engine
  missions: {
    play_games: 25,
    earn_coins: 25,
    watch_ads: 35, // best reward → nudges the revenue action
    distinct_games: 30,
  },
  // Per-run gameplay payout = floor(score / scoreDivisor), scaled by level.
  reward: { scoreDivisor: 12, perLevelBonus: 0.25 },
  spin: {
    cost: 120, // paid re-spin
    // weighted prize table (label, coins, weight)
    prizes: [
      { coins: 40, weight: 24 },
      { coins: 80, weight: 16 },
      { coins: 20, weight: 26 },
      { coins: 150, weight: 7 },
      { coins: 30, weight: 22 },
      { coins: 400, weight: 3 },
      { coins: 60, weight: 14 },
      { coins: 10, weight: 26 },
    ],
  },

  // ── Sinks ──
  // Revive: first revive ≈ one good run's payout, then doubles — so serial
  // reviving on one run gets expensive fast (or watch an ad instead).
  revive: { baseCost: 50, growth: 2 }, // 50 → 100 → 200 …
  boosters: { hammer: 40, newPieces: 60, extraTube: 50 },
};

/** Coins to revive after `reviveCount` prior revives this run. */
export function reviveCost(reviveCount: number): number {
  return ECONOMY.revive.baseCost * Math.pow(ECONOMY.revive.growth, reviveCount);
}
