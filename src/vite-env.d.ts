/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMOB_BANNER?: string;
  readonly VITE_ADMOB_INTERSTITIAL?: string;
  readonly VITE_ADMOB_REWARDED?: string;
  readonly VITE_ADMOB_APP_OPEN?: string;
  readonly VITE_ADMOB_NATIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
