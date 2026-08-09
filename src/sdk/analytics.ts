// Analytics — one thin `track()` the whole app calls. On Android it forwards
// to Firebase Analytics (once the plugin is installed + configured); in the
// browser it logs to the console. It never throws and needs no config to build.
//
// We access the plugin via Capacitor.Plugins so this file has ZERO build-time
// dependency on the Firebase plugin — install it during Firebase setup and
// events start flowing automatically. See FIREBASE-SETUP.md.

import { Capacitor } from "@capacitor/core";

type Params = Record<string, string | number | boolean>;

export function track(event: string, params: Params = {}) {
  try {
    const plugin = (Capacitor as unknown as { Plugins?: Record<string, any> }).Plugins
      ?.FirebaseAnalytics;
    if (plugin?.logEvent) {
      plugin.logEvent({ name: event, params });
      return;
    }
  } catch {
    /* never let analytics break gameplay */
  }
  if (import.meta.env.DEV) console.debug("[analytics]", event, params);
}

/** Set a stable user property once (e.g. after profile creation). */
export function setUserProp(key: string, value: string) {
  try {
    const plugin = (Capacitor as unknown as { Plugins?: Record<string, any> }).Plugins
      ?.FirebaseAnalytics;
    plugin?.setUserProperty?.({ key, value });
  } catch {
    /* ignore */
  }
}
