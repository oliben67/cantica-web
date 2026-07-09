import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Node 22+'s native (opt-in) localStorage global shadows jsdom's window.localStorage
    // in vitest's environment setup, since vitest only overrides globals that Node doesn't
    // already define. Disabling the native one lets jsdom's implementation take over.
    execArgv: ["--no-experimental-webstorage"],
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://localhost:8042",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8042",
        changeOrigin: true,
      },
    },
  },
});
