import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';

const SIZES: [number, string][] = [
  [5, 'Mini 5×5'],
  [7, 'Midi 7×7'],
  [9, 'Classic 9×9'],
  [11, 'Big 11×11'],
  [13, 'Bigger 13×13'],
  [15, 'Full 15×15'],
];

const LEVELS: [number, string][] = [
  [1, 'Monday · gentle'],
  [2, 'Tuesday · easygoing'],
  [3, 'Wednesday · crafty'],
  [5, 'Friday · devious'],
  [6, 'Saturday · diabolical'],
];

export function renderFreePlay(root: HTMLElement, _ctx: RouteCtx): void {
  let size = 5;
  let level = 1;

  const sizeRow = el('div', { className: 'picker-row' });
  const levelRow = el('div', { className: 'picker-row' });

  const renderChips = (): void => {
    sizeRow.replaceChildren(
      ...SIZES.map(([value, label]) => {
        const chip = el('button', { className: `chip ${value === size ? 'active' : ''}` }, label);
        chip.addEventListener('click', () => { size = value; renderChips(); });
        return chip;
      }),
    );
    levelRow.replaceChildren(
      ...LEVELS.map(([value, label]) => {
        const chip = el('button', { className: `chip ${value === level ? 'active' : ''}` }, label);
        chip.addEventListener('click', () => { level = value; renderChips(); });
        return chip;
      }),
    );
  };
  renderChips();

  const playBtn = el('button', { className: 'btn primary' }, 'Build my puzzle');
  playBtn.addEventListener('click', () => {
    const seed = Math.floor(Math.random() * 1e9).toString(36);
    navigate(`puzzle/gen?mode=free&size=${size}&difficulty=${level}&seed=${seed}`);
  });

  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Free Play'),
      el('p', { className: 'view-sub' }, 'Fresh grids on demand — the engine builds a new one every time.'),
      el('span', { className: 'field-label' }, 'Size'),
      sizeRow,
      el('span', { className: 'field-label' }, 'Difficulty'),
      levelRow,
      el('div', { style: 'margin-top: 20px' }, playBtn),
    ),
  );
}
