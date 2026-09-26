# Pocket Carnival — Launch Runbook (Android + AdMob)

Turn the web app into a signed Android app, put it on Google Play, and earn
ad revenue. This is the full ads-first launch guide.

> **AdSense vs AdMob** — you asked about AdSense; **AdSense is for websites and
> does NOT work inside Android apps.** Games use **Google AdMob** (same Google
> login, different product). This repo is wired for AdMob. A *website* version
> of the games could use AdSense separately.

---

## The ad surface (all wired in code)

| Placement | Where it fires | Code |
|---|---|---|
| **Banner** | Always, pinned to the bottom of every screen | `sdk.showBanner()` in `initAds()` |
| **Interstitial** | Between rounds — staged: none for a new player's first 5 rounds, then 1 every 3 round-ends | `sdk.roundEnded()` |
| **Rewarded — Double it** | "🎬 Double it" on every win screen | `showOverlay` → `sdk.watchRewarded()` |
| **Rewarded — Watch & Earn** | Home "📺 Watch & Earn" card: +20 🪙 per ad, capped at 8/day | `sdk.watchToEarn()` |
| **App-open** | On cold start / resume | `sdk.showAppOpen()` in `initAds()` |
| **Consent (UMP)** | Once at startup, where the law requires it | `initAds()` → `requestConsentInfo` |

Tune the economics in [src/sdk/platform.ts](src/sdk/platform.ts):
`ADS_FREE_ROUNDS`, `INTERSTITIAL_EVERY`, `EARN_COINS_PER_AD`, `EARN_MAX_PER_DAY`.
All ad code lives in [src/sdk/ads.ts](src/sdk/ads.ts) and no-ops safely in the
browser (the bottom banner shows a labeled placeholder there).

---

## The path, in four stages

```
1. WRAP    HTML5 app  ──Capacitor──►  native Android project   ← configured ✓
2. BUILD   project  ──Android Studio──►  signed .aab           ← your machine
3. PUBLISH .aab  ──Play Console ($25 once)──►  live            ← your accounts
4. EARN    AdMob account ──link──►  ads pay to your bank       ← wired ✓
```

Stages 1 & 4 are done in code. You run 2 & 3 on your machine — they need
Android Studio, which isn't installed here, so the `.aab` binary is built there.

---

## Prerequisites (install once)

1. **Android Studio** — https://developer.android.com/studio (bundles the SDK + a JDK).
   Open it once to finish first-run setup.
2. If a terminal build can't find Java: `brew install --cask temurin@17`.

---

## Stage 1 — Generate the Android project

`appId` is **`app.bettersuite.pocketcarnival`** in [capacitor.config.ts](capacitor.config.ts)
— final, under the BetterSuite brand. **Permanent after your first upload.**
Create every store/service entry (Play, App Store, Firebase, AdMob, RevenueCat)
against this exact ID.

```bash
npm run cap:add        # creates android/ (run once)
npm run android:open   # builds web, copies it in, opens Android Studio
```

Re-run `npm run android:sync` after any code change to copy the new build in.

**Then make the three required native edits** — see
[android-manifest-additions.xml](android-manifest-additions.xml):
1. `INTERNET` + `AD_ID` permissions in `AndroidManifest.xml`.
2. Your AdMob **App ID** `meta-data` in `<application>`.
3. `versionCode` / `versionName` in `android/app/build.gradle`.

### App icon + splash
```bash
npm i -D @capacitor/assets
# put a 1024×1024 PNG at resources/icon.png (export it from public/icon.svg)
# and a 2732×2732 PNG at resources/splash.png (brand background #341073)
npx @capacitor/assets generate --android
```
This produces every launcher/splash size automatically.

---

## Stage 2 — Build a signed release `.aab`

Google Play requires an **AAB** (App Bundle), not a raw APK.

**a) Create your upload keystore ONCE (then guard it forever):**
```bash
keytool -genkey -v -keystore pocketcarnival-upload.keystore \
  -alias pocketcarnival -keyalg RSA -keysize 2048 -validity 10000
```
- Back up the `.keystore` + passwords in a password manager.
- **Lose this key and you can never update the app again.** Enroll in **Play App
  Signing** at upload so Google keeps a recoverable signing key.
- It's already in `.gitignore` — never commit it.

**b)** In Android Studio: `Build ▸ Generate Signed App Bundle ▸ Android App
Bundle`, pick the keystore, choose **release**, build. Output:
`android/app/release/app-release.aab`.

---

## Stage 3 — Publish on Google Play Console

1. **Register** at https://play.google.com/console — **$25 one-time**. New
   accounts need identity verification and (for individuals) a ~14-day closed
   test with 12+ testers before production. Start this early.
2. **Create app** → "Pocket Carnival", **Game**, Free.
3. **Required forms** (all must be green to publish):
   - **Privacy Policy URL** — required because you run ads and collect the ad ID.
     Host a page (a generator works); it must mention AdMob/Google ads.
   - **Data safety** — declare AdMob collects the advertising ID (+ approx.
     location for ads).
   - **Ads declaration** — answer **"Yes, contains ads."**
   - Content rating questionnaire, target audience (this app is all-ages but
     shows ads — pick your audience carefully; if you target under-13 you must
     use only child-safe ad content).
4. **Store listing** — descriptions, 512×512 icon, 1024×500 feature graphic,
   ≥2 phone screenshots (grab from an emulator/device).
5. **Upload the `.aab`** → Production (or Closed testing first).
6. **Roll out.** First review: a few days to ~2 weeks for new accounts.

---

## Stage 4 — Turn on the money (AdMob)

1. Sign up at https://admob.google.com with the **same Google account**.
2. **Add app**, then **create ad units**: Banner, Interstitial, Rewarded,
   App Open. Each gives an ID like `ca-app-pub-XXXX/ZZZZ`.
3. Put the unit IDs in a project-root `.env` (see [.env.example](.env.example)):
   ```
   VITE_ADMOB_BANNER=ca-app-pub-…/…
   VITE_ADMOB_INTERSTITIAL=ca-app-pub-…/…
   VITE_ADMOB_REWARDED=ca-app-pub-…/…
   VITE_ADMOB_APP_OPEN=ca-app-pub-…/…
   ```
   Then `npm run android:sync`. With no `.env`, the app uses Google's **test**
   units (safe). The **App ID** (the `~` one) goes in AndroidManifest, not here.
4. **Get paid:** AdMob ▸ Payments — add bank + tax info. Google pays monthly
   once you pass **$100**.

> ⚠️ **Never tap your own live ads** and don't ask friends to. Invalid activity
> gets your AdMob account banned. Always QA with the **test** units (the default
> here) or a registered test device.

---

## Pre-launch checklist

- [ ] `appId` finalized in `capacitor.config.ts` (permanent!)
- [ ] `npm run cap:add` done; the 3 manifest/gradle edits merged
- [ ] AdMob **App ID** in AndroidManifest; unit IDs in `.env`
- [ ] Icon + splash generated from `public/icon.svg`
- [ ] Upload keystore created + backed up; Play App Signing enrolled
- [ ] Privacy policy hosted; Data safety + Ads forms completed
- [ ] Store listing assets ready (icon, feature graphic, screenshots)
- [ ] Tested on a real device with **test** ad units — banner, interstitial,
      both rewarded flows, app-open all appear
- [ ] `versionCode`/`versionName` set; signed `.aab` built
- [ ] **Coins are virtual only — no real-money stakes** (India 2025 RMG law)

## Revenue reality
Ad income scales with daily active users — roughly **$0.01–0.05 per DAU/day**
for casual games, higher with strong rewarded-video usage (which this app leans
into: the win-screen "Double it" + the home "Watch & Earn" card are your two
highest-eCPM placements). The app is built; earnings now come from installs and
retention. India = ads-forward, which is exactly how this is tuned.
