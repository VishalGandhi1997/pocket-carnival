# Coin Economy — Balance Model

All numbers live in one place: [src/sdk/economy.ts](src/sdk/economy.ts). Change
them there and the whole app (SDK, games, spin, shop) updates. This doc explains
*why* the numbers are what they are.

## The core principle (ads-first)

Coins must feel **slightly scarce**. If free coins pile up unspent, two things
die at once: the reason to **watch rewarded ads** (our main revenue) and the
reason to **buy a coin pack** (secondary revenue). So every faucet is balanced
against a sink the player actually wants.

The loop we're engineering:
> earn a bit → want a skin/revive/booster → come up short at the exciting moment
> → **watch an ad** (revenue) or **buy coins** (revenue) or **come back tomorrow** (retention).

## Faucets — where coins come from

| Source | Value | Per day (engaged) | Notes |
|---|---|---|---|
| Starting balance | 100 | — | enough to try a revive/booster and learn its value |
| Daily bonus | 15 + 4×streak (cap 7) | ~19 → ~43 | rewards the return habit |
| **Watch & Earn** | 25 / ad, 6/day | **150** | the ad-revenue engine — keep it worth doing |
| Daily missions (3) | 25–35 each | ~90 | drives sessions + steers to the watch-ad action |
| Free daily spin | weighted avg ~55 | ~55 | fun, habit-forming |
| Gameplay payout | floor(score/12) × level bonus | ~40–80 | scales with skill/level |
| **Engaged total** | | **≈ 350–400/day** | casual players land ~150–200 |

Note two of the biggest faucets (**Watch & Earn** and the **watch-ads mission**)
are *ad views* — earning here IS our revenue, so we keep them attractive.

## Sinks — where coins go

| Sink | Cost | Sized against… |
|---|---|---|
| Revive | 50 → 100 → 200 … (doubles) | ~one good run's payout, then punishing — nudges the ad-revive or "stop" |
| Booster · Hammer | 40 | a couple per session ≈ a mission's worth |
| Booster · New Pieces | 60 | |
| Booster · +1 Tube | 50 | |
| Lucky Spin (extra) | 120 | a paid gamble on top of the free one |
| **Skin — entry** (Blaze/Ocean/Sunset) | 250–350 | **~1 day** of saving |
| **Skin — mid** (Galaxy/Midnight) | 750–800 | a few days |
| **Skin — premium** (Golden/Rose Gold) | 1500–1800 | ~a week, or a ₹79–₹249 pack |
| **Skin — chase** (Rainbow) | 2500 | maps to the ₹249 "Bag of Coins" (2000) + a little grind |

## Coin packs (IAP) — the conversion target

| Pack | Coins | Price* | Buys you… |
|---|---|---|---|
| Pocket | 500 | ₹79 | 2 entry skins, or a stack of revives |
| Bag (BEST) | 2,000 | ₹249 | a premium skin outright |
| Chest | 5,000 | ₹499 | the whole cosmetic set |

\* Fallback labels only — real prices are localized by the store per the user's
account country (see [FIREBASE-SETUP.md](FIREBASE-SETUP.md) → IAP).

The premium/chase skins are deliberately priced **just above** a comfortable
save, so the specific cosmetic a player wants maps cleanly onto a specific pack.
That mapping is what actually sells packs.

## How to tune from here

- **Coins feel too easy / nobody buys** → lower `watchEarn.maxPerDay`, raise skin
  costs, or steepen `revive.growth`.
- **Coins feel too tight / retention drops** → raise `daily.base`, add cheaper
  cosmetics, or lower entry-skin costs.
- **Want more ad views** → make the watch-ads mission reward highest (it already
  is) and keep revive's ad option prominent.
- Do this with **live analytics** (ARPDAU, ad-views/DAU, coin balance over time)
  once Firebase is on — tune to data, not guesses.

## Guardrail
Coins are **virtual only** — never redeemable for cash or prizes (India 2025 RMG
law). This is a progression/cosmetic currency, not gambling.
