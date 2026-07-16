/** Boot-time version check — the app's answer to "caching issues that
 * continue to haunt this development." Compares the version baked into the
 * currently-running bundle against a freshly (never-cached, see sw.js)
 * fetched version.json. If they differ, blocks rendering behind a
 * full-screen overlay and drives the player to the latest build: first the
 * graceful path (nudge the service worker to activate the new version and
 * reload once it takes over), falling back to a manual "Update now" button
 * that nukes every service worker and cache before reloading. */

import { el } from '../ui/dom.ts';

/** "0.1.0+a1b2c3d" — see vite.config.ts. Exported so Settings can print it. */
export const CURRENT_VERSION = __APP_VERSION__;

interface VersionPayload { version: string }

/** Deliberately a plain inequality — the version string already encodes both
 * the release number and the exact commit, so any difference at all means
 * "not what's live right now." Pure, so it's unit-tested directly. */
export function needsUpdate(current: string, latest: string): boolean {
  return current !== latest;
}

function parsePayload(data: unknown): VersionPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const version = (data as Record<string, unknown>).version;
  return typeof version === 'string' ? { version } : null;
}

const FETCH_TIMEOUT_MS = 2000;
const RELOAD_GRACE_MS = 2500;
const RELOAD_FLAG = 'xw.versionReload';

async function fetchLatestVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parsePayload(await res.json())?.version ?? null;
  } catch {
    return null; // offline, blocked, or slow — fail OPEN. This is a local-first
    // app; an inability to check must never itself block play.
  } finally {
    clearTimeout(timeout);
  }
}

function buildOverlay(onUpdateNow: () => void): { root: HTMLElement; revealButton: () => void } {
  const button = el('button', {
    className: 'btn primary', style: 'display:none; margin-top: 8px',
    onclick: onUpdateNow,
  }, 'Update now');

  const root = el('div', { className: 'modal-backdrop version-gate' },
    el('div', { className: 'card modal version-gate-card' },
      el('div', { className: 'version-gate-spinner', 'aria-hidden': 'true' }),
      el('h2', { className: 'version-gate-title' }, 'Updating…'),
      el('p', { className: 'muted', style: 'font-size:0.9rem; margin: 0' },
        'Riddle Crossword just shipped an update — hang tight, this only takes a second.'),
      button,
    ),
  );
  return { root, revealButton: () => { button.style.display = ''; } };
}

async function forceCleanReload(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch { /* best effort — reload below still helps */ }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { /* best effort */ }
  location.reload();
}

/** Runs once at boot, before the app renders anything else. Resolves 'ok' if
 * the running build is current (or freshness couldn't be determined — e.g.
 * offline) and the caller should render normally; resolves 'updating' if it
 * should NOT render — the overlay now owns the screen until the page
 * reloads (automatically, or via the manual button). */
export async function checkForUpdate(): Promise<'ok' | 'updating'> {
  if (!('serviceWorker' in navigator)) return 'ok'; // nothing to gate against — no SW cache to be stale from

  const latest = await fetchLatestVersion();
  if (!latest || !needsUpdate(CURRENT_VERSION, latest)) return 'ok';

  const { root, revealButton } = buildOverlay(() => { void forceCleanReload(); });
  document.body.append(root);

  // Already tried reloading for this exact version this tab session — don't
  // spin forever if something's genuinely stuck; go straight to the manual escape.
  if (sessionStorage.getItem(RELOAD_FLAG) === latest) {
    revealButton();
    return 'updating';
  }
  sessionStorage.setItem(RELOAD_FLAG, latest);

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    void reg?.update();
  } catch { /* fall through to the manual button below */ }

  setTimeout(() => { if (!reloaded) revealButton(); }, RELOAD_GRACE_MS);
  return 'updating';
}
