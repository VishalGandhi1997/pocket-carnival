// Billing — in-app purchases. Real Google Play Billing on Android (via a
// Capacitor billing plugin, accessed through Capacitor.Plugins so this file
// has no build-time dependency); simulated instant success in the browser so
// the shop flow is testable. See FIREBASE-SETUP.md → "In-app purchases".

import { Capacitor } from "@capacitor/core";
import { AppConfig } from "../config/app-config";
import { toast } from "./platform";

export interface Product {
  id: string; // must match the product ID you create in Play Console
  title: string;
  emoji: string;
  // FALLBACK price for the browser/preview only. On a real device we ignore
  // this and show the store's own localized price ($ in the US, € in Europe, …).
  // Google/Apple pick the currency from the user's STORE ACCOUNT country, not
  // their IP/GPS — so we never geolocate or convert currency ourselves.
  priceLabel: string;
  coins?: number; // coins granted (undefined = non-consumable, e.g. remove ads)
  removeAds?: boolean;
  best?: boolean; // highlight as best value
}

export const PRODUCTS: Product[] = [
  { id: "coins_small", title: "Pocket of Coins", emoji: "🪙", priceLabel: "$0.99", coins: 500 },
  { id: "coins_medium", title: "Bag of Coins", emoji: "💰", priceLabel: "$2.99", coins: 2000, best: true },
  { id: "coins_large", title: "Chest of Coins", emoji: "🎁", priceLabel: "$5.99", coins: 5000 },
  { id: "remove_ads", title: "Remove Ads", emoji: "🚫", priceLabel: "$2.49", removeAds: true },
];

const isNative = Capacitor.isNativePlatform();

/**
 * Ask the store for each product's LOCALIZED price string. Google Play returns
 * it already formatted in the user's local currency based on their Play account
 * country — we just display it verbatim (this is also required by Play policy).
 * Returns a map of productId → price string. Empty in the browser, where the
 * Shop falls back to `priceLabel`.
 */
export async function loadStorePrices(): Promise<Record<string, string>> {
  if (!isNative) return {};
  try {
    const plugin = (Capacitor as unknown as { Plugins?: Record<string, any> }).Plugins
      ?.InAppPurchase;
    if (!plugin?.getProducts) return {};
    const res = await plugin.getProducts({ productIds: PRODUCTS.map((p) => p.id) });
    const map: Record<string, string> = {};
    for (const p of res?.products ?? []) {
      // plugins expose the localized price as `price` or `priceString`
      const price = p.price ?? p.priceString;
      if (p.productId && price) map[p.productId] = price;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Attempt a purchase. Returns true on success.
 * - Browser/web build: NO fake commerce. Fails honestly unless the dev-only
 *   AppConfig.DEMO_PURCHASES flag is on (default OFF — see app-config.ts).
 * - Native: calls the billing plugin (RevenueCat/Play Billing once the owner
 *   fills REVENUECAT_KEY); returns false gracefully while unconfigured.
 */
export async function purchase(product: Product): Promise<boolean> {
  if (!isNative) {
    if (AppConfig.DEMO_PURCHASES) {
      // Dev-only simulated purchase for testing the grant/celebration flow.
      await new Promise((r) => setTimeout(r, 400));
      return true;
    }
    toast("Purchases are available in the app version 📱");
    return false;
  }
  try {
    const plugin = (Capacitor as unknown as { Plugins?: Record<string, any> }).Plugins
      ?.InAppPurchase;
    if (!plugin?.purchase) return false;
    const res = await plugin.purchase({ productId: product.id });
    return !!res?.success;
  } catch {
    return false;
  }
}
