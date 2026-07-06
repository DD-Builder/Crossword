/** Sample the live skin tokens once per play — scenes never read the DOM
 * themselves, so the same scene code renders correctly under every skin
 * and mode (and under a stub palette in tests). */

import type { Palette } from './types.ts';

const FALLBACK: Palette = {
  bg: '#faf7f0',
  surface: '#ffffff',
  ink: '#1c1b18',
  inkMuted: '#6b6659',
  accent: '#2f6fde',
  accentSoft: '#dbe7fb',
  cellSelected: '#ffd83d',
  cellBlock: '#1c1b18',
  good: '#2e9e44',
  warn: '#d9822b',
  bad: '#d1383d',
  fontDisplay: 'Georgia, serif',
  dark: false,
};

export function samplePalette(): Palette {
  if (typeof document === 'undefined') return { ...FALLBACK };
  const style = getComputedStyle(document.body);
  const token = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    bg: token('--bg', FALLBACK.bg),
    surface: token('--surface', FALLBACK.surface),
    ink: token('--ink', FALLBACK.ink),
    inkMuted: token('--ink-muted', FALLBACK.inkMuted),
    accent: token('--accent', FALLBACK.accent),
    accentSoft: token('--accent-soft', FALLBACK.accentSoft),
    cellSelected: token('--cell-selected', FALLBACK.cellSelected),
    cellBlock: token('--cell-block', FALLBACK.cellBlock),
    good: token('--good', FALLBACK.good),
    warn: token('--warn', FALLBACK.warn),
    bad: token('--bad', FALLBACK.bad),
    fontDisplay: token('--font-display', FALLBACK.fontDisplay),
    dark: document.documentElement.dataset.mode === 'dark',
  };
}
