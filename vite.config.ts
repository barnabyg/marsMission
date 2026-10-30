import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Mission Mode loads these lazily. Without this, the development server discovers them mid-game
  // and reloads the page, which loses the Program.
  optimizeDeps: { include: ["three", "@react-three/fiber"] },
  build: {
    // Three.js is one chunk of about 700 kB, loaded only by Mission Mode. The game runs from
    // the local machine (ADR 0001), so the default 500 kB web limit doesn't apply. Review this
    // if the game is ever hosted.
    chunkSizeWarningLimit: 1200,
  },
});
