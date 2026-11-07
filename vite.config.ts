import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Mission Mode loads these lazily. Without this, the development server discovers them mid-game
  // and reloads the page, which loses the Program.
  optimizeDeps: { include: ["three", "@react-three/fiber"] },
  // Off Vite's defaults (5173 and 4173), which other local apps commonly use. Saves live in browser
  // storage tied to the address, so changing a port hides every Program saved on the old one.
  server: { port: 5280 },
  preview: { port: 4280 },
  build: {
    // Three.js is one chunk of about 700 kB, loaded only by Mission Mode. The game runs from
    // the local machine (ADR 0001), so the default 500 kB web limit doesn't apply. Review this
    // if the game is ever hosted.
    chunkSizeWarningLimit: 1200,
  },
});
