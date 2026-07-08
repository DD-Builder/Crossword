import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { getSettings } from '../../storage/settings.ts';
import { estimateMinutes, sizeForTargetMinutes } from '../../core/generator/difficulty.ts';
import type { Register } from '../../core/types.ts';

const SIZES: [number, string][] = [
  [5, 'Mini 5×5'],
  [7, 'Midi 7×7'],
  [9, 'Classic 9×9'],
  [11, 'Big 11×11'],
  [13, 'Bigger 13×13'],
  [15, 'Full 15×15'],
  [17, 'Grand 17×17'],
  [19, 'Epic 19×19'],
  [21, 'Sunday 21×21'],
];

const LEVELS: [number, string][] = [
  [1, 'Monday · gentle'],
  [2, 'Tuesday · easygoing'],
  [3, 'Wednesday · crafty'],
  [4, 'Thursday · tricky'],
  [5, 'Friday · devious'],
  [6, 'Saturday · diabolical'],
  [7, 'Sunday · grand'],
];

// Clue difficulty independent of the fill. '' = match the day's difficulty.
const CLUE_TIERS: [string, string][] = [
  ['', 'Match'],
  ['1', 'Straight'],
  ['3', 'Witty'],
  ['5', 'Devious'],
];

const STYLES: [Register, string][] = [
  ['modern', 'Modern'],
  ['classic', 'Classic'],
];

// Target finish time (minutes). '' = let me pick the size myself.
const TARGETS: [string, string][] = [
  ['', 'Pick size'],
  ['2', '~2 min'],
  ['5', '~5 min'],
  ['10', '~10 min'],
  ['20', '~20 min'],
];

export function renderFreePlay(root: HTMLElement, _ctx: RouteCtx): void {
  let size = 5;
  let level = 1;
  let clueTier = '';
  let style: Register = getSettings().clueRegister;
  let target = '';

  const sizeRow = el('div', { className: 'picker-row' });
  const levelRow = el('div', { className: 'picker-row' });
  const clueRow = el('div', { className: 'picker-row' });
  const styleRow = el('div', { className: 'picker-row' });
  const targetRow = el('div', { className: 'picker-row' });
  const estimate = el('p', { className: 'view-sub', style: 'margin-top:6px' });

  const chipRow = <T>(
    row: HTMLElement,
    items: [T, string][],
    current: () => T,
    pick: (v: T) => void,
  ): void => {
    row.replaceChildren(
      ...items.map(([value, label]) => {
        const chip = el('button', { className: `chip ${value === current() ? 'active' : ''}` }, label);
        chip.addEventListener('click', () => { pick(value); renderChips(); });
        return chip;
      }),
    );
  };

  const renderChips = (): void => {
    // Target time, when set, drives the size — so hide the size row then.
    const effectiveSize = target ? sizeForTargetMinutes(Number(target), level) : size;
    chipRow(sizeRow, SIZES, () => effectiveSize, (v) => { size = v; });
    chipRow(levelRow, LEVELS, () => level, (v) => { level = v; });
    chipRow(clueRow, CLUE_TIERS, () => clueTier, (v) => { clueTier = v; });
    chipRow(styleRow, STYLES, () => style, (v) => { style = v; });
    chipRow(targetRow, TARGETS, () => target, (v) => { target = v; });
    sizeRow.style.opacity = target ? '0.5' : '1';
    sizeRow.style.pointerEvents = target ? 'none' : 'auto';
    const mins = estimateMinutes(effectiveSize, level);
    estimate.textContent = `Estimated finish: about ${Math.max(1, Math.round(mins))} min at this size and difficulty.`;
  };
  renderChips();

  const playBtn = el('button', { className: 'btn primary' }, 'Build my puzzle');
  playBtn.addEventListener('click', () => {
    const seed = Math.floor(Math.random() * 1e9).toString(36);
    const finalSize = target ? sizeForTargetMinutes(Number(target), level) : size;
    const params = new URLSearchParams({
      mode: 'free', size: String(finalSize), difficulty: String(level),
      register: style, seed,
    });
    if (clueTier) params.set('cluetier', clueTier);
    navigate(`puzzle/gen?${params.toString()}`);
  });

  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Free Play'),
      el('p', { className: 'view-sub' }, 'Fresh grids on demand — the engine builds a new one every time.'),
      el('span', { className: 'field-label' }, 'Target time'),
      targetRow,
      el('span', { className: 'field-label' }, 'Size'),
      sizeRow,
      el('span', { className: 'field-label' }, 'Difficulty'),
      levelRow,
      el('span', { className: 'field-label' }, 'Clue difficulty'),
      clueRow,
      el('span', { className: 'field-label' }, 'Clue style'),
      styleRow,
      estimate,
      el('div', { style: 'margin-top: 16px' }, playBtn),
    ),
  );
}
