import { defineConfig } from "vite";

// Vite ignores the PORT env var by default; honor it so the harness can
// assign a free port (autoPort) instead of colliding on 5173.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;

export default defineConfig({
  // Relative base so the build works on GitHub Pages (/repo-name/ subpath)
  // and inside the Capacitor WebView alike.
  base: "./",
  server: { port, strictPort: false },
  preview: { port },
});
