# Khel Mela — Launch Checklist (BetterSuite go-live)

Brand: **BetterSuite** (bettersuite.app) · Seller of record: your legal name
(individual enrollment, both stores) · App/bundle ID: **`app.bettersuite.khelmela`**
· Slug: **`khelmela`** · Support: **support@bettersuite.app**

Everything not requiring your accounts, keys, devices, or the bettersuite.app
domain is **DONE** (marked ✅). What remains is the OWNER ACTIONS list at the end.

---

## ✅ Completed (no action needed)

### Branding & legal
- ✅ All placeholder emails replaced with **support@bettersuite.app** (app docs + all legal pages).
- ✅ Privacy/Terms/Support links point to the BetterSuite URLs
  (`bettersuite.app/khelmela/privacy/`, `/khelmela/support/`, `/terms/`) — wired
  in the in-app profile sheet ("A **BetterSuite** app" + Privacy · Terms · Support links)
  and across the store docs.
- ✅ "A BetterSuite app" credit on the home footer and profile sheet.
- ✅ Legal pages updated: BetterSuite publisher line, both-store refund wording,
  and the sign-in paragraph corrected to match reality (no account exists).
- ✅ Interim hosting stays live on GitHub Pages (auto-deploy on push) until the
  bettersuite.app pages are up:
  https://vishalgandhi1997.github.io/khel-mela/privacy-policy.html · …/terms.html

### Bundle ID migration (was `com.khelmela.games`)
- ✅ `capacitor.config.ts` → **`app.bettersuite.khelmela`** (Android package AND
  future iOS bundle id — Capacitor uses one appId for both).
- ✅ All runbooks/docs updated to the new ID.
- ⚠️ **Touches signing/store setup (flagged, all owner-side):** the Play app
  entry, upload keystore, Play App Signing, Firebase `google-services.json`,
  AdMob app link, and RevenueCat app must ALL be created against
  `app.bettersuite.khelmela`. Nothing was ever uploaded under the old ID, so
  there is no migration debt — just use the new ID everywhere from day one.

### Billing honesty
- ✅ **No fake commerce in shipped builds.** The browser's simulated purchase
  path is now gated behind `VITE_DEMO_PURCHASES` (default **OFF**; dev-only).
  With the flag off, non-store purchase attempts fail honestly with
  "Purchases are available in the app version 📱".
- ✅ Real billing wired to clearly-named placeholders: `REVENUECAT_KEY` in
  [src/config/app-config.ts](src/config/app-config.ts) + `VITE_REVENUECAT_KEY`
  in [.env.example](.env.example). Billing no-ops gracefully while empty.
- ✅ No mock auth exists (sign-in stub was removed in the earlier audit; the
  privacy policy now matches).

### Store pack (`store/`)
- ✅ [listing.md](store/listing.md) — final Play + App Store copy (title,
  subtitle, short/full descriptions, 95-char Apple keyword string, categories,
  all BetterSuite URLs).
- ✅ [compliance.md](store/compliance.md) — content-rating questionnaire
  answers, **Play Data Safety** rows and **Apple privacy-label** entries that
  match the build's actual SDK behavior (AdMob only; no analytics SDK compiled;
  local-only save data), plus the iOS ATT note.
- ✅ [screenshots-shotlist.md](store/screenshots-shotlist.md) — 8-shot device
  list with sizes for both stores, captions, feature-graphic + icon export steps.

### Quality gate
- ✅ Strict TypeScript + production build pass clean (see repo CI-able scripts).
- ✅ Stale text fixed everywhere ("30 games" → 35 in app title, manifest,
  welcome screen, footer); manifest phantom PNG icons removed earlier.
- ✅ Placeholder/dead-link sweep: no `khelmela.app` emails, no old bundle id,
  no StockGro identifiers anywhere in the repo or git history metadata
  (commits authored via GitHub noreply).
- ✅ Deployed web build verified live after changes (home, About links, shop
  honesty message).

---

## OWNER ACTIONS
*(only things that require your accounts, keys, devices, or decisions — in order)*

1. **bettersuite.app hosting** — publish the legal pages at the canonical URLs:
   copy `store/privacy-policy.html` → `bettersuite.app/khelmela/privacy/`,
   `store/terms.html` → `bettersuite.app/terms/`, and stand up
   `bettersuite.app/khelmela/support/` (a simple contact page listing
   support@bettersuite.app is enough). Create the `support@bettersuite.app`
   mailbox (or alias).
2. **Google Play Developer account** ($25, individual) — ID verification, then
   create the app as `app.bettersuite.khelmela`; expect the ~14-day closed test
   with 12+ testers before production.
3. **Apple Developer Program** ($99/yr, individual) — register the
   `app.bettersuite.khelmela` bundle ID; App Store Connect app record. (iOS
   build also needs `npx cap add ios` + Xcode on a Mac with your certificates.)
4. **AdMob account** — create the app (linked to the new package), 4 ad units,
   paste unit IDs into `.env`, App ID into AndroidManifest; bank + tax details.
5. **Firebase project** (when you want analytics/cloud) — Android app with the
   NEW package name, download `google-services.json` into `android/app/`.
6. **RevenueCat project** (for IAP) — create app for `app.bettersuite.khelmela`,
   fill `VITE_REVENUECAT_KEY` in `.env`, create the 4 store products
   (`coins_small`, `coins_medium`, `coins_large`, `remove_ads`) in Play/App
   Store Connect, add a license-tester account.
7. **Android Studio on your machine** — `npm run cap:add`, merge
   [android-manifest-additions.xml](android-manifest-additions.xml), generate
   icon/splash (`npx @capacitor/assets generate --android`), create + back up
   the **upload keystore** (new one, for the new package), build the signed `.aab`.
8. **Device QA + screenshots** — run the shot-list on your phone
   ([store/screenshots-shotlist.md](store/screenshots-shotlist.md)); QA per
   [APK-AND-PLAYSTORE.md](APK-AND-PLAYSTORE.md) §pre-launch (test ads, IAP with
   license tester, Delete-my-data, consent prompt, notch layout).
9. **Store forms** — paste listing copy, Data Safety + privacy-label answers
   from [store/compliance.md](store/compliance.md), content rating, "contains
   ads: Yes", privacy URL `https://bettersuite.app/khelmela/privacy/`.
10. **Decisions:** confirm slug `khelmela` + app display name "Khel Mela";
    iOS ads choice (ATT prompt for personalized ads vs non-personalized without
    ATT — affects the Apple privacy label per compliance.md).

*Reference docs: [APK-AND-PLAYSTORE.md](APK-AND-PLAYSTORE.md) ·
[FIREBASE-SETUP.md](FIREBASE-SETUP.md) · [store/](store/) · [ECONOMY.md](ECONOMY.md)*
