import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The 3D shop is a separate app (own dev server, build and Vercel project) that renders the main
// store's storefront components from ../src for all shopping UI. React and the other packages
// those components use come from the repo root's node_modules, so there is a single copy of each.
export default defineConfig({
  plugins: [react()],
  envDir: "..",
  appType: "spa",
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: { allow: [".."] },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
