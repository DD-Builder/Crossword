/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function shortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev'; // no git (e.g. some Capacitor packaging contexts) — still unique enough per npm-version bump
  }
}

// "0.1.0+a1b2c3d" — package.json's version plus the exact commit, so every
// deploy (even without a version bump) gets a distinct, comparable id. Baked
// into the JS bundle via `define` below (immutable per build), and mirrored
// to a fetchable version.json (see the plugin below) so a running tab can
// check what's *actually* live without trusting its own (possibly stale
// cached) copy of this file.
const APP_VERSION = `${pkg.version}+${shortSha()}`;
const BUILT_AT = new Date().toISOString();

/** Emits dist/version.json — deliberately NOT copied from public/ (which
 * would itself be subject to the same caching this exists to defeat) but
 * generated fresh into the build output on every `vite build`. sw.js special-
 * cases this URL to always hit the network, never the cache. */
function versionJsonPlugin(): Plugin {
  return {
    name: 'write-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, builtAt: BUILT_AT }),
      });
    },
  };
}

// GitHub Pages serves this repo at https://<user>.github.io/Crossword/ —
// base must match the repo name there. Local dev and Capacitor use '/'.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Crossword/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [versionJsonPlugin()],
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
