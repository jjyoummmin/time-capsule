import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer/",
    },
  },
  optimizeDeps: {
    include: ["buffer", "tlock-js", "drand-client"],
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
