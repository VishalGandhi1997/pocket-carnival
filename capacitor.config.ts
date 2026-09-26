import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Reverse-domain ID under the BetterSuite studio brand. This is the
  // permanent Play package name AND iOS bundle id — it can NEVER change
  // after the first store upload. Nothing has been uploaded yet.
  appId: "app.bettersuite.pocketcarnival",
  appName: "Pocket Carnival",
  // Vite builds to dist/. `npx cap sync` copies this into the native app.
  webDir: "dist",
  backgroundColor: "#341073",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    AdMob: {
      // App ID + permissions go in AndroidManifest — see APK-AND-PLAYSTORE.md.
    },
  },
};

export default config;
