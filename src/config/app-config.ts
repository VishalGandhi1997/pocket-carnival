// ── Build-time app configuration ─────────────────────────────────────
// Single place for release gates and third-party keys. Everything here is
// safe to commit: real secrets come from .env (never committed) and are
// read via import.meta.env at build time.

export const AppConfig = {
  /**
   * DEMO_PURCHASES — dev-only fake commerce gate. Default OFF.
   *
   * When false (always, for any shipped build): the Shop renders, but
   * purchase attempts outside a real store context fail honestly with a
   * "purchases are available in the app version" message. No simulated
   * checkout, no pretend grants.
   *
   * When true (local development only): browser purchases instantly
   * "succeed" so the grant/celebration flow can be tested without a device.
   * Never ship a build with this on.
   */
  DEMO_PURCHASES: import.meta.env.VITE_DEMO_PURCHASES === "true",

  /**
   * REVENUECAT_KEY — public SDK key for real billing (RevenueCat wraps
   * Play Billing / StoreKit and handles receipt validation). Empty until
   * the owner creates the RevenueCat project and fills .env.
   * The native purchase path no-ops gracefully while this is empty.
   */
  REVENUECAT_KEY: import.meta.env.VITE_REVENUECAT_KEY ?? "",
} as const;
