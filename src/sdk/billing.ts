// Billing — in-app purchases. Real Google Play Billing on Android (via a
// Capacitor billing plugin, accessed through Capacitor.Plugins so this file
// has no build-time dependency); simulated instant success in the browser so
// the shop flow is testable. See FIREBASE-SETUP.md → "In-app purchases".

import { Capacitor } from "@capacitor/core";

export interface Product {
  id: string; // must match the product ID you create in Play Console
  title: string;
  emoji: string;
  // FALLBACK price for the browser/preview only. On a real device we ignore
  // this and show the store's own localized price (₹ in India, $ in the US, …).
  // Google/Apple pick the currency from the user's STORE ACCOUNT country, not
  // their IP/GPS — so we never geolocate or convert currency ourselves.
  priceLabel: string;
  coins?: number; // coins granted (undefined = non-consumable, e.g. remove ads)
  removeAds?: boolean;
  best?: boolean; // highlight as best value
}

export const PRODUCTS: Product[] = [
  { id: "coins_small", title: "Pocket of Coins", emoji: "🪙", priceLabel: "₹79", coins: 500 },
  { id: "coins_medium", title: "Bag of Coins", emoji: "💰", priceLabel: "₹249", coins: 2000, best: true },
  { id: "coins_large", title: "Chest of Coins", emoji: "🎁", priceLabel: "₹499", coins: 5000 },
  { id: "remove_ads", title: "Remove Ads", emoji: "🚫", priceLabel: "₹199", removeAds: true },
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
 * - Browser: simulates success so the shop + grant flow can be tested.
 * - Android: calls the Play Billing plugin if present; otherwise returns false.
 */
export async function purchase(product: Product): Promise<boolean> {
  if (!isNative) {
    // Simulated purchase for web/preview testing.
    await new Promise((r) => setTimeout(r, 400));
    return true;
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
