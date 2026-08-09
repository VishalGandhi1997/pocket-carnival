# Firebase & Backend Setup — Your Steps

The app already **calls** analytics, cloud sign-in, leaderboards, push, and IAP
in the code. These four things physically need your Google/Firebase account and
a device build to go live. Each section below is click-by-click, ~10–20 min each.
Do them in order; you can ship without them (the app runs fully standalone today).

Everything here is free on Firebase's Spark (no-cost) plan except real ad/IAP
payouts, which run through AdMob/Play separately.

---

## 0) Create the Firebase project (once, ~5 min)

1. Go to <https://console.firebase.google.com> → **Add project** → name it
   "Khel Mela" → accept → **Create**.
2. In the project, click the **Android** icon to add an Android app.
   - **Android package name:** `app.bettersuite.khelmela` (must match
     `capacitor.config.ts` exactly).
   - Register → **download `google-services.json`**.
3. Put `google-services.json` in `android/app/` (after you've run
   `npm run cap:add`). It's already git-ignored.
4. In `android/build.gradle` add to the `dependencies` of `buildscript`:
   `classpath 'com.google.gms:google-services:4.4.2'`
   and at the **bottom** of `android/app/build.gradle`:
   `apply plugin: 'com.google.gms.google-services'`

That's the base. Now enable the features you want.

---

## 1) Analytics (events → dashboards) — easiest, do first

The app already calls `track()` for: `game_over`, `daily_claim`,
`rewarded_watched`, `mission_claim`, `purchase`, `daily_claim`. To receive them:

```bash
npm i @capacitor-firebase/analytics
npm run android:sync
```
1. In Firebase Console → **Analytics** → it turns on automatically once the app
   runs on a device.
2. Nothing else to code — [src/sdk/analytics.ts](src/sdk/analytics.ts) auto-detects
   the plugin via `Capacitor.Plugins.FirebaseAnalytics` and starts sending events.
3. See data in **Analytics → Events** (real-time within minutes; full reports in ~24h).

> This is the single most important step for an ads business — it's how you'll
> know D1/D7 retention and which games/ads perform.

---

## 2) Cloud sign-in (Google) — makes the "Sign in" button real

Right now sign-in is a local stub. To make it sync across devices:

```bash
npm i @capacitor-firebase/authentication
npm run android:sync
```
1. Firebase Console → **Authentication → Get started → Sign-in method →
   enable Google**.
2. Add your app's **SHA-1** fingerprint (Firebase → Project settings → your
   Android app → Add fingerprint). Get it with:
   `cd android && ./gradlew signingReport` (use the SHA1 under `Variant: release`).
3. The UI currently ships with NO sign-in button (the non-functional stub was
   removed in the launch audit). When enabling this, add a "Sign in to sync"
   button to the profile sheet in [src/shell/app.ts](src/shell/app.ts) that calls:
   ```ts
   import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
   const res = await FirebaseAuthentication.signInWithGoogle();
   sdk.markSignedIn(); // then migrate local save → Firestore under res.user.uid
   ```
   Also update the privacy policy + Data Safety form FIRST (see
   store/compliance.md) — they currently declare "no account".

---

## 3) Leaderboards (real cloud scores) — replaces the local ladder

The app shows a believable local ladder today. To make ranks global:

1. Firebase Console → **Firestore Database → Create database** → Production mode
   → pick a region (asia-south1 for India).
2. Add these security rules (Firestore → Rules). **Critical:** scope writes to
   the user's OWN document — `if request.auth != null` alone lets any signed-in
   user overwrite anyone's data. Encoding the UID in the doc id and checking it
   enforces per-user separation:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       // Doc id is `${gameId}_${week}_${uid}` — writer must own that uid.
       match /scores/{docId} {
         allow read: if true;  // leaderboards are public
         allow write: if request.auth != null
                      && docId.split('_')[2] == request.auth.uid
                      && request.resource.data.score is int
                      && request.resource.data.score >= 0;
       }
       // Per-user save data: only the owner can read/write their own doc.
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
   Scores are also **server-validated** as non-negative ints so a tampered
   client can't inject absurd values. (For real anti-cheat, write scores from a
   Cloud Function rather than the client.)
3. `npm i @capacitor-firebase/firestore && npm run android:sync`
4. In [src/sdk/leaderboard.ts](src/sdk/leaderboard.ts), replace `fetchTop`'s body
   with a Firestore query (top 10 by score for `gameId` this week), and in
   [src/sdk/platform.ts](src/sdk/platform.ts) `submitScore`, write the score
   under the user's own uid:
   ```ts
   FirebaseFirestore.setDocument({
     reference: `scores/${gameId}_${weekKey}_${uid}`, // uid MUST be the signed-in user
     data: { name, avatar, score, gameId, week: weekKey },
   });
   ```
   **Account deletion:** `sdk.deleteAllData()` clears local data. On device,
   before calling it also delete the user's cloud docs
   (`users/${uid}` and their `scores/*`) so deletion is complete — Play policy
   requires erasing server-side data too, plus a web URL where users can request
   deletion without the app.
   The UI needs no changes — it already renders whatever `fetchTop` returns.

---

## 4) Push notifications (FCM) — the biggest re-engagement lever

```bash
npm i @capacitor-firebase/messaging
npm run android:sync
```
1. Firebase Console → **Cloud Messaging** is enabled by default.
2. Add to `android/app/src/main/AndroidManifest.xml` inside `<application>` a
   default notification icon/colour (optional) and ensure the
   `POST_NOTIFICATIONS` permission is present (Android 13+):
   `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`
3. On app start, request permission + get the token:
   ```ts
   import { FirebaseMessaging } from "@capacitor-firebase/messaging";
   await FirebaseMessaging.requestPermissions();
   const { token } = await FirebaseMessaging.getToken();
   // save token to Firestore so you can target this user
   ```
4. **Send notifications** two ways:
   - Manual: Firebase Console → **Messaging → New campaign** (great for
     "Weekend tournament is live!").
   - Automated re-engagement (recommended): a scheduled Cloud Function that
     pings users whose `lastDaily` was 1–3 days ago — "🎁 Your daily bonus +
     streak are waiting!". This is what drives casual-game retention.

---

## 5) In-app purchases (real money for the Shop)

The Shop works with simulated purchases in the browser. For real Play Billing:

1. **Play Console → Monetize → In-app products** — create products with IDs that
   EXACTLY match [src/sdk/billing.ts](src/sdk/billing.ts):
   `coins_small`, `coins_medium`, `coins_large` (consumables) and `remove_ads`
   (non-consumable). Set one **base price**; Google auto-generates local prices
   for ~170 countries (override any you like).
2. Install a billing plugin, e.g. `npm i @capacitor-community/in-app-purchases`
   (or RevenueCat's Capacitor SDK for easier receipt validation).
3. In `billing.ts`, replace the `Capacitor.Plugins.InAppPurchase` access with the
   plugin's real `purchase()` / `restorePurchases()` calls. The grant logic
   (`sdk.grantCoins` / `sdk.grantRemoveAds`) already runs on success.
4. **Currency is automatic — do NOT geolocate or convert.** `loadStorePrices()`
   already queries the store for each product's **localized price string**
   (`₹79` in India, `$0.99` in the US, …) and the Shop displays it. Google picks
   the currency from the user's **Play account country**, not their IP/GPS, and
   Play policy requires showing the store's price. Your hardcoded `priceLabel`
   values are only a browser/preview fallback.
5. Test with a **license tester** account (Play Console → Setup → License testing)
   so you're not charged real money during QA.

---

## Quick reference — what's wired vs. what you enable

| Feature | In code now | You add |
|---|---|---|
| Analytics events | ✅ `track()` everywhere | Install plugin + `google-services.json` |
| Guest play | ✅ fully working | nothing |
| Cloud sign-in | ✅ stub + UI | Enable Google auth, swap 2 handlers |
| Leaderboard UI | ✅ + local ladder | Firestore + swap `fetchTop` |
| Push | — (documented) | Messaging plugin + token save |
| Shop UI + grants | ✅ + simulated buy | Play products + billing plugin |
| Ads (banner/interstitial/rewarded/app-open) | ✅ (see APK-AND-PLAYSTORE.md) | AdMob IDs |

You can launch with just **Analytics + Ads + IAP** and add sign-in/leaderboards/
push in a fast-follow update — none of them block your first release.
