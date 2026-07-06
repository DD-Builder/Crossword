/** localStorage-backed settings. All keys namespaced under "xw.". */

export type Mode = 'light' | 'dark' | 'system';

export interface LlmConfig {
  provider: 'anthropic' | 'openai' | 'gemini' | 'xai' | 'custom';
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface Settings {
  skin: string;
  mode: Mode;
  autocheck: boolean;
  smartSkip: boolean;       // cursor skips filled cells while typing
  adaptive: boolean;        // stats nudge generated puzzles
  sound: boolean;
  victoryAnimations: boolean; // per-skin canvas spectacle on solve
  playerName: string;
  kidsGrade: string;        // '', 'K', '1'..'8'
  llm: LlmConfig | null;
}

const DEFAULTS: Settings = {
  skin: 'classic',
  mode: 'system',
  autocheck: false,
  smartSkip: true,
  adaptive: true,
  sound: true,
  victoryAnimations: true,
  playerName: '',
  kidsGrade: '',
  llm: null,
};

const KEY = 'xw.settings';

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — settings stay in-memory */
  }
  applyTheme(next);
  return next;
}

/** Resolve 'system' to the actual mode via media query. */
export function resolvedMode(s: Settings = getSettings()): 'light' | 'dark' {
  if (s.mode !== 'system') return s.mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(s: Settings = getSettings()): void {
  const rootEl = document.documentElement;
  rootEl.dataset.skin = s.skin;
  rootEl.dataset.mode = resolvedMode(s);
  const themeColor = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor || '#faf7f0');
}

/** Re-apply on system scheme change when in system mode. */
export function watchSystemTheme(): void {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getSettings().mode === 'system') applyTheme();
  });
}

/* --- Generic small persisted values (progress, streaks, PBs) ----------- */

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`xw.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(`xw.${key}`, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(`xw.${key}`);
  } catch { /* ignore */ }
}
