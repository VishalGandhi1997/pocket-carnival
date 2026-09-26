# Pocket Carnival — Master Casual Gaming App

One app, 40 original mini-games. See [GAME-DISCOVERY-EXECUTION-PLAN.md](GAME-DISCOVERY-EXECUTION-PLAN.md) for the research-backed strategy and [GAMES-LIST.md](GAMES-LIST.md) for the full roster.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (dist/)
```

## Architecture

```
src/
  main.ts             entry point
  style.css           design system ("cosmic carnival" theme)
  shell/app.ts        home screen, game screen, navigation, wallet header
  sdk/platform.ts     the ONE bridge games talk to: coins, best scores,
                      haptics, toasts (localStorage now → Firebase/native later)
  engine/canvas.ts    shared canvas harness: DPI sizing, rAF loop,
                      pointer + swipe input, brand palette, cleanup
  engine/ui.ts        shared HUD + standard win/lose overlay
  games/registry.ts   all 40 games, each with a `mount` + `howTo`
  games/<id>/index.ts one self-contained module per game
```

**Rules of the platform:**
- Games never touch localStorage/ads/analytics directly — only the `sdk`.
- Games are pure modules: `mount(host, sdk) => cleanup`. No globals, no leaks.
- All colors come from `palette` in `engine/canvas.ts` so every game looks like one family.
- End-of-round always uses `showOverlay` (consistent reward screen everywhere).

## Adding a single-player game

1. Create `src/games/<id>/index.ts` exporting `mount<Name>(host, sdk)`.
2. Use `createGameCanvas` + `makeHud` + `showOverlay`.
3. On round end: `sdk.submitScore(id, score)` + `sdk.addCoins(...)`.
4. Add one line to `games/registry.ts`, including a `howTo` steps array (replace the "coming soon" stub).

## Adding a multiplayer game

Same as above, plus:
1. Signature is `mount<Name>(host, sdk, opts?: { mode?: "bot" | "pnp" })` — the shell shows
   a mode-select screen automatically for any `players: "multi"` entry before mounting.
2. Use `makeTurnBanner` to show whose turn it is (`tone: "you" | "opp"`).
3. `"bot"` mode: after the human's move, `setTimeout` your AI's move (see `charchaal`/`katakat`
   for simple heuristics, `chaupar`/`sanpsidhi` for dice-based bots).
4. `"pnp"` mode: both players act on the same device. Board games alternate taps on one
   canvas; only Paddle Duel needs true simultaneous multi-touch (bypasses the engine's
   single-pointer helpers — see its `localPoint` usage for the pattern).
5. Always add a `howTo` array — the shell auto-shows it on first visit and offers a
   permanent "❓" button in the topbar to reopen it.

## Road to Android

Wrap the built `dist/` with [Capacitor](https://capacitorjs.com):
`npm i @capacitor/core @capacitor/android && npx cap init && npx cap add android`.
The `sdk` interface is where AdMob (rewarded/interstitial), IAP, and Firebase
(auth, wallet, leaderboards) plug in without touching any game code.

## Compliance guardrails
- No real-money stakes or cash prizes (India 2025 online gaming law).
- No copied art, names, level data, or trade dress — generic mechanics only,
  original presentation ("take the verb, never the skin").
