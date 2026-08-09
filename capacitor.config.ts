import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Reverse-domain ID. This is your permanent Play Store package name —
  // it can NEVER be changed after your first upload, so pick carefully.
  appId: "com.khelmela.games",
  appName: "Khel Mela",
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
