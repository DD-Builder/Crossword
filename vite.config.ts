/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages serves this repo at https://<user>.github.io/Crossword/ —
// base must match the repo name there. Local dev and Capacitor use '/'.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Crossword/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: process.env.VITE_SOURCEMAP === '1',
    target: 'es2022',
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    // Playwright owns e2e/**; vitest runs the co-located src tests only.
    include: ['src/**/*.test.ts'],
  },
});
