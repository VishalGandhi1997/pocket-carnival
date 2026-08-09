// Ad service — the complete AdMob surface for an ads-first launch.
// Real ads on Android; safe no-ops (and a DOM banner placeholder) in the
// browser so the web build + preview still run.
//
// IMPORTANT: mobile apps monetize with **AdMob**, not AdSense. AdSense is for
// websites. Same Google login, different product. See APK-AND-PLAYSTORE.md.
//
// The IDs below are Google's official TEST units — safe to develop against.
// Put your real IDs in .env before release (see .env.example). Never click
// your own live ads: it gets your AdMob account banned.

import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

// Google public TEST ad units. Real ones come from .env at build time.
const TEST = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
  appOpen: "ca-app-pub-3940256099942544/9257395921",
};

const IDS = {
  banner: import.meta.env.VITE_ADMOB_BANNER || TEST.banner,
  interstitial: import.meta.env.VITE_ADMOB_INTERSTITIAL || TEST.interstitial,
  rewarded: import.meta.env.VITE_ADMOB_REWARDED || TEST.rewarded,
  appOpen: import.meta.env.VITE_ADMOB_APP_OPEN || TEST.appOpen,
};

let ready = false;
let bannerShown = false;

// Lazy single import of the plugin (keeps it out of the browser bundle path).
async function admob() {
  const mod = await import("@capacitor-community/admob");
  return mod;
}

/**
 * Initialize AdMob + collect user consent (UMP). Consent is legally required
 * to serve personalized ads (EU/GDPR) and is AdMob policy everywhere.
 * Call once at startup. No-op in the browser.
 */
export async function initAds(): Promise<void> {
  if (!isNative) return;
  try {
    const { AdMob } = await admob();
    await AdMob.initialize({ initializeForTesting: false });
    // UMP consent flow — shows the form only when required by region/law.
    try {
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === "REQUIRED") {
        await AdMob.showConsentForm();
      }
    } catch {
      /* consent SDK unavailable in this plugin version — continue */
    }
    ready = true;
  } catch (e) {
    console.warn("AdMob init failed; running ad-free:", e);
  }
}

/** Adaptive anchored banner pinned to the bottom. Content padding is added
 *  by the shell (see reserveBannerSpace). No-op in the browser. */
export async function showBanner(): Promise<void> {
  if (!isNative || !ready || bannerShown) return;
  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await admob();
    await AdMob.showBanner({
      adId: IDS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
    bannerShown = true;
  } catch (e) {
    console.warn("Banner failed:", e);
  }
}

export async function hideBanner(): Promise<void> {
  if (!isNative || !bannerShown) return;
  try {
    const { AdMob } = await admob();
    await AdMob.hideBanner();
    bannerShown = false;
  } catch {
    /* ignore */
  }
}

/** Full-screen ad between rounds. Resolves when dismissed. Browser: instant. */
export async function showInterstitial(): Promise<void> {
  if (!isNative || !ready) return;
  try {
    const { AdMob } = await admob();
    await AdMob.prepareInterstitial({ adId: IDS.interstitial });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn("Interstitial failed:", e);
  }
}

/** App-open ad, shown on cold start / resume. Feature-detected because not
 *  every plugin version supports it. Browser: no-op. */
export async function showAppOpen(): Promise<void> {
  if (!isNative || !ready) return;
  try {
    const mod = (await admob()) as unknown as {
      AdMob: {
        prepareAppOpen?: (o: { adId: string }) => Promise<void>;
        showAppOpen?: () => Promise<void>;
      };
    };
    if (mod.AdMob.prepareAppOpen && mod.AdMob.showAppOpen) {
      await mod.AdMob.prepareAppOpen({ adId: IDS.appOpen });
      await mod.AdMob.showAppOpen();
    }
  } catch (e) {
    console.warn("App-open ad unavailable:", e);
  }
}

/**
 * Rewarded video. Resolves true only if watched to completion. Browser
 * resolves true instantly so the reward path is testable without a device.
 */
export async function showRewarded(): Promise<boolean> {
  if (!isNative || !ready) return true;
  try {
    const { AdMob, RewardAdPluginEvents } = await admob();
    let earned = false;
    const handle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      earned = true;
    });
    await AdMob.prepareRewardVideoAd({ adId: IDS.rewarded });
    await AdMob.showRewardVideoAd();
    handle.remove();
    return earned;
  } catch (e) {
    console.warn("Rewarded ad failed:", e);
    return false;
  }
}

export const adsAreNative = isNative;
