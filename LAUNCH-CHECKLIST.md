# Khel Mela — Launch Checklist (Path to 100/100)

The app code and UX are launch-ready. The remaining gap to 100 is **external
wiring only you can do** — accounts, a signed build, store submission, and
hosting. This is the ordered, do-it-once list. Estimated total hands-on time:
**~1 working day**, plus Google's review/testing waits.

Tick each box. When all are done, you're at 100.

---

## 0) One-time prerequisites (install / decide) — ~30 min

- [ ] Install **Android Studio** — https://developer.android.com/studio (bundles the Android SDK + JDK).
- [ ] Decide your **brand identifiers** (used everywhere below):
  - **App name:** Khel Mela (or your choice)
  - **Package name:** `com.khelmela.games` — *permanent after first upload; change it now in `capacitor.config.ts` if you want a different one.*
  - **Support email + domain:** you need a real email for the store listing and the legal pages. The docs currently use the placeholder **`support@khelmela.app`** — replace it with an address you own (see step 4).

---

## 1) Google accounts & credentials — ~1–2 hrs (+ verification wait)

| # | What | Where | Notes |
|---|------|-------|-------|
| 1a | **Google Play Developer account** | https://play.google.com/console | **$25 one-time.** New personal accounts require **ID verification** and a **~14-day closed test with 12+ testers** before you can go to production — start this first, it has the longest wait. |
| 1b | **AdMob account** | https://admob.google.com | Same Google login. This is what pays you for ads. |
| 1c | **Firebase project** | https://console.firebase.google.com | Free (Spark plan). Powers analytics, cloud save, leaderboards, push. |

- [ ] 1a — Register Play Console, complete identity verification.
- [ ] 1b — Create AdMob account.
- [ ] 1c — Create the Firebase project; add an Android app with your **exact package name**; download **`google-services.json`**.

---

## 2) Ad units & real IDs — ~30 min

Follow [APK-AND-PLAYSTORE.md](APK-AND-PLAYSTORE.md) § 4 and [.env.example](.env.example).

- [ ] In AdMob, create 4 ad units: **Banner, Interstitial, Rewarded, App Open.**
- [ ] Copy your `.env.example` → `.env` and paste the 4 real unit IDs.
- [ ] Put your AdMob **App ID** (the `~` one) into `AndroidManifest.xml` (see [android-manifest-additions.xml](android-manifest-additions.xml)).
- [ ] Add bank + tax details in AdMob → Payments (payout at $100).

> ⚠️ Never tap your own live ads. QA only with the built-in **test** IDs (the default) or a registered test device.

---

## 3) In-app products — ~20 min

- [ ] In Play Console → Monetize → In-app products, create products with IDs **exactly** matching [src/sdk/billing.ts](src/sdk/billing.ts): `coins_small`, `coins_medium`, `coins_large`, `remove_ads`.
- [ ] Set one base price each (Google auto-localizes to every currency — do **not** hardcode prices).
- [ ] Add a **license-tester** account (Play Console → Setup → License testing) so you can test buying without being charged.

---

## 4) Legal pages — host them & set your email — ~20 min

The pages are written, brand-neutral, and **already hosted via GitHub Pages**
(auto-redeployed on every push to `main`):

- ✅ **Live now:** https://vishalgandhi1997.github.io/khel-mela/privacy-policy.html
  and https://vishalgandhi1997.github.io/khel-mela/terms.html
  (source of truth: `public/*.html`; the copies in `store/` feed the Play listing docs)
- [ ] Replace **`support@khelmela.app`** in both pages with your real support email, push.
- [ ] Paste the **Privacy Policy URL** above into Play Console → Store settings, **and** into the Data safety form.

---

## 5) Native build → signed `.aab` — ~1 hr

Full steps in [APK-AND-PLAYSTORE.md](APK-AND-PLAYSTORE.md) § 1–2.

- [ ] `npm run cap:add` (generates the `android/` project).
- [ ] Drop `google-services.json` into `android/app/`.
- [ ] Merge the manifest/gradle edits from [android-manifest-additions.xml](android-manifest-additions.xml) (INTERNET + AD_ID permissions, AdMob App ID, versionCode/versionName).
- [ ] Generate the app icon + splash: `npm i -D @capacitor/assets`, export `public/icon.svg` → a 1024×1024 `resources/icon.png`, then `npx @capacitor/assets generate --android`.
- [ ] Create your **upload keystore** (`keytool …`) and **back it up** — losing it means you can never update the app.
- [ ] In Android Studio: Build ▸ Generate Signed App Bundle ▸ release → produces `app-release.aab`.

---

## 6) Store listing assets — ~30 min

Everything is drafted in [store/](store/); you just assemble.

- [ ] App name, short + full description → copy from [store/listing.md](store/listing.md).
- [ ] App icon 512×512 (export from `public/icon.svg`).
- [ ] Feature graphic 1024×500 (open `store/feature-graphic.html`, screenshot it).
- [ ] 2–8 phone screenshots (screenshot the running app: home, a puzzle, a win screen, a 2-player game).
- [ ] Complete the **Data safety** form (declare AdMob collects advertising ID + approx. location), **content rating** questionnaire, and answer **"contains ads: Yes."**

---

## 7) Wire the Firebase features (optional for v1, needed for 100) — ~2–3 hrs

All documented in [FIREBASE-SETUP.md](FIREBASE-SETUP.md). Priority order:

- [ ] **Analytics** (do first — you're flying blind without it): `npm i @capacitor-firebase/analytics`, then events flow automatically.
- [ ] **Google Sign-In** (re-adds the cloud-save button that was removed as a non-functional stub): enable Google auth, add your SHA-1, wire the two marked handlers.
- [ ] **Cloud leaderboards**: create Firestore, paste the **user-scoped security rules** from the doc (these enforce per-user data separation — don't skip), swap the `fetchTop` function.
- [ ] **Push notifications (FCM)** + the re-engagement Cloud Function.
- [ ] **Restore purchases** for Remove Ads (Play requires it) — wire the real billing plugin's `restorePurchases()`.

---

## 8) Final QA on a real device — ~1 hr

The browser preview can't test everything; do this on a phone once you have the APK/AAB.

- [ ] Play each game to game-over; confirm scores, coins, revive, boosters.
- [ ] Confirm ads show (test IDs): banner, interstitial between rounds, both rewarded flows, app-open on cold start.
- [ ] Buy a coin pack + Remove Ads with the license-tester account; confirm ads disappear and coins credit.
- [ ] Test **Delete my data** wipes everything; confirm the consent (UMP) prompt appears.
- [ ] Check layout on a notched phone (safe-area padding) and a small screen.

---

## Definition of done — the 100/100 scorecard

| Area | Reaches 100 when… |
|---|---|
| Ads / revenue | Real AdMob IDs live; payments set up; restore-purchases wired |
| Backend | Firebase analytics + auth + Firestore rules + FCM live |
| Legal | Privacy + Terms hosted at real URLs with your email; data-safety form done |
| Compliance | Content rating done; account deletion (already built) + consent verified on device |
| Build | Signed `.aab` uploaded; icon/splash/screenshots in place |
| Testing | Closed test passed (12+ testers, ~14 days); device QA green |

Work through sections 1 → 8 and every scorecard row turns green. **Nothing in
the app code blocks you** — it's all account setup, one signed build, and
Google's review/testing waits.

---

### Quick reference — where each piece lives
- Android build + store submission → [APK-AND-PLAYSTORE.md](APK-AND-PLAYSTORE.md)
- Firebase (analytics/auth/leaderboards/push/IAP) → [FIREBASE-SETUP.md](FIREBASE-SETUP.md)
- Store copy + assets → [store/](store/)
- Economy tuning levers → [ECONOMY.md](ECONOMY.md)
- Legal pages → [store/privacy-policy.html](store/privacy-policy.html), [store/terms.html](store/terms.html)
