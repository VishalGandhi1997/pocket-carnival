# Compliance Answers — Pocket Carnival (`app.bettersuite.pocketcarnival`)

Answers below are written to MATCH the actual shipped behavior of this build:
- No account/sign-in. All game progress is stored **locally on-device only**.
- No analytics SDK is compiled in yet (`src/sdk/analytics.ts` no-ops until the
  Firebase plugin is installed — if you add it later, UPDATE these answers).
- Google AdMob is the only data-collecting SDK (ads).
- Optional IAP (coin packs, Remove Ads) processed by the store; billing is
  inert until REVENUECAT_KEY is configured.
- No real-money gaming; virtual coins have no cash value; no UGC, no chat.

---

## Content rating questionnaire (IARC — used by Google Play)

| Question | Answer | Note |
|---|---|---|
| Violence (realistic/cartoon), blood | **No** | Abstract shapes/emoji only |
| Sexual content / nudity | **No** | |
| Profanity / crude humour | **No** | |
| Drugs, alcohol, tobacco | **No** | |
| Fear/horror themes | **No** | |
| Gambling with real money | **No** | Explicitly prohibited in app |
| Simulated gambling (casino-style) | **No** | Prize wheel/card flip use no wagering, no casino theming; coins are non-cashable. If a reviewer disputes, accept the bump (PEGI 7/E10+) rather than argue |
| In-app digital purchases | **Yes** | Coin packs, Remove Ads |
| Ads displayed | **Yes** | AdMob |
| Shares user location | **No** | App never requests location permission (AdMob derives coarse region from IP server-side) |
| User interaction / UGC / chat | **No** | Pass & play is same-device only |
| Expected rating | Everyone / PEGI 3 | |

**Play "Ads" declaration:** Yes, contains ads.
**Play Target audience:** 13+ (do NOT tick under-13 — avoids Families policy
ad restrictions; app is general-audience, not child-directed).

---

## Google Play Data Safety form

Overall:
- **Does your app collect or share user data?** Yes (via the AdMob SDK only).
- **Is all data encrypted in transit?** Yes (HTTPS).
- **Do you provide a way to request deletion?** Yes — in-app "Delete my data"
  (profile screen) + email support@bettersuite.app; deletion URL:
  https://bettersuite.app/pocketcarnival/privacy/ (deletion section).
- **Account creation:** none.

Declare exactly these data types (all attributed to advertising via AdMob):

| Data type | Collected? | Shared? | Processed ephemerally | Required/Optional | Purposes |
|---|---|---|---|---|---|
| Device or other IDs (Advertising ID) | Yes | Yes (Google/ad partners) | No | Required (ads) | Advertising or marketing |
| Approximate location (IP-derived) | Yes | Yes | Yes | Required (ads) | Advertising or marketing |
| App interactions (ad events) | Yes | Yes | No | Required (ads) | Advertising, fraud prevention |
| Crash logs / diagnostics (AdMob SDK) | Yes | Yes | No | Required | App functionality, fraud prevention |

Do **NOT** declare: name, email, contacts, precise location, financial info,
photos, files, health, messages — the app touches none of these. Player
name/avatar/coins/scores stay on-device (on-device data is not "collected"
under Play's definition).

> If you later add Firebase Analytics: add "App interactions → Analytics".
> If you add cloud sync/sign-in: add "User IDs" + update the privacy policy first.

---

## Apple App Privacy ("nutrition label")

**Data Used to Track You** (only if you request ATT and serve personalized ads):
- Identifiers → Device ID (advertising identifier)

**Data Linked to You:** None.

**Data Not Linked to You:**
- Identifiers → Device ID — Third-Party Advertising
- Location → Coarse Location — Third-Party Advertising
- Usage Data → Advertising Data, Product Interaction — Third-Party Advertising
- Diagnostics → Crash Data, Performance Data — App Functionality

**App Tracking Transparency (iOS):** if serving personalized AdMob ads, the app
MUST show the ATT prompt before tracking; Google's UMP consent flow (already
integrated in `src/sdk/ads.ts`) presents it. Alternative: configure AdMob for
non-personalized ads only on iOS and answer "no tracking".

**Sign in with Apple:** not required (no third-party sign-in exists).

---

## Standing guardrails (both stores)
- Coins are virtual-only, non-cashable — keep every string and feature this way
  (India's 2025 online gaming law; both stores' gambling policies).
- The demo purchase flag (`VITE_DEMO_PURCHASES`) must be OFF in any store build
  — the shipped app contains no simulated commerce.
- Privacy policy + this form must be updated BEFORE enabling Firebase/cloud sync.
