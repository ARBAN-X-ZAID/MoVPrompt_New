import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  envDir: "../../",
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  // The legacy Supabase MCP bundle remains frozen under /supabase while the
  // portable API replaces it. Do not regenerate a new function inside apps/web.
  plugins: [react()],
  // Local recipe/contract builds must reach the creator immediately rather
  // than remaining in Vite's pre-bundled workspace dependency cache.
  optimizeDeps: {
    exclude: ["@movprompt/creative-engine", "@movprompt/contracts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
