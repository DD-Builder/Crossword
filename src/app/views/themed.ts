import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { getSettings } from '../../storage/settings.ts';

/** Curated packs surface by season — the calendar decides the shelf order. */
interface Pack {
  key: string;
  title: string;
  emoji: string;
  months: number[]; // months (1-12) when this pack is front-of-shelf
}

const PACKS: Pack[] = [
  { key: 'july4', title: 'Stars & Stripes', emoji: '🎆', months: [6, 7] },
  { key: 'summer', title: 'Endless Summer', emoji: '🏖️', months: [6, 7, 8] },
  { key: 'school', title: 'Back to School', emoji: '🎒', months: [8, 9] },
  { key: 'halloween', title: 'All Hallows', emoji: '🎃', months: [10] },
  { key: 'thanksgiving', title: 'The Big Feast', emoji: '🦃', months: [11] },
  { key: 'christmas', title: 'Midwinter Merriment', emoji: '🎄', months: [12] },
  { key: 'newyear', title: 'Fresh Starts', emoji: '🎊', months: [1] },
  { key: 'valentines', title: 'Heart Eyes', emoji: '💘', months: [2] },
  { key: 'spring', title: 'Spring Fling', emoji: '🌷', months: [3, 4, 5] },
  { key: 'olympics', title: 'Going for Gold', emoji: '🥇', months: [] },
  { key: 'worldcup', title: 'The Beautiful Game', emoji: '⚽', months: [] },
  { key: 'movies', title: 'Movie Night', emoji: '🍿', months: [] },
  { key: 'music', title: 'Turn It Up', emoji: '🎸', months: [] },
  { key: 'food', title: 'Delicious Words', emoji: '🍜', months: [] },
  { key: 'science', title: 'Lab Coat Optional', emoji: '🔭', months: [] },
  { key: 'travel', title: 'Wanderlust', emoji: '🧭', months: [] },
  { key: 'animals', title: 'Creature Feature', emoji: '🦉', months: [] },
  { key: 'sports', title: 'Game On', emoji: '🏟️', months: [] },
];

export function renderThemed(root: HTMLElement, _ctx: RouteCtx): void {
  const month = new Date().getMonth() + 1;
  const inSeason = PACKS.filter((p) => p.months.includes(month));
  const evergreen = PACKS.filter((p) => !p.months.includes(month));

  const playPack = (pack: Pack): void => {
    const seed = Math.floor(Math.random() * 1e9).toString(36);
    navigate(`puzzle/gen?mode=themed&theme=${encodeURIComponent(pack.key)}&size=9&difficulty=3&seed=${seed}`);
  };

  const packCard = (pack: Pack): HTMLElement => {
    const card = el('button', { className: 'mode-card card' },
      el('span', { className: 'mode-kicker' }, pack.emoji),
      el('h3', {}, pack.title),
    );
    card.addEventListener('click', () => playPack(pack));
    return card;
  };

  // Free-text theme box — the "any topic" engine.
  const input = el('input', {
    className: 'text-input',
    type: 'text',
    placeholder: 'Augustine’s Confessions, sourdough, the Silk Road…',
    'aria-label': 'Type any theme',
  }) as HTMLInputElement;

  const sizeChips = el('div', { className: 'picker-row' });
  let themeSize = 9;
  const renderSizeChips = (): void => {
    sizeChips.replaceChildren(
      ...[[7, 'Quick 7×7'], [9, 'Classic 9×9'], [11, 'Roomy 11×11']].map(([v, label]) => {
        const chip = el('button', { className: `chip ${v === themeSize ? 'active' : ''}` }, String(label));
        chip.addEventListener('click', () => { themeSize = v as number; renderSizeChips(); });
        return chip;
      }),
    );
  };
  renderSizeChips();

  const goBtn = el('button', { className: 'btn primary' }, 'Build it');
  const go = (): void => {
    const theme = input.value.trim();
    if (!theme) {
      input.focus();
      return;
    }
    const seed = Math.floor(Math.random() * 1e9).toString(36);
    navigate(`puzzle/gen?mode=themed&theme=${encodeURIComponent(theme)}&size=${themeSize}&difficulty=3&seed=${seed}`);
  };
  goBtn.addEventListener('click', go);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
    e.stopPropagation(); // keep solver-style global keys away from the input
  });

  const hasKey = Boolean(getSettings().llm?.apiKey);

  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Themed Puzzles'),
      el('p', { className: 'view-sub' }, 'Seasonal specials from the library, or a made-to-order puzzle on any topic you can type.'),

      el('span', { className: 'field-label' }, 'Your theme, your puzzle'),
      el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap; align-items:center' }, input, goBtn),
      sizeChips,
      el('p', { className: 'muted', style: 'font-size:0.85rem; margin-top:6px' },
        hasKey
          ? 'AI-assisted: your configured model proposes theme entries and clues; our engine builds and verifies the grid.'
          : 'No AI key set — themes are matched against our library. Add a key in Settings for truly bespoke topics.',
      ),

      ...(inSeason.length > 0
        ? [el('h2', { className: 'section-label' }, 'In season'),
           el('div', { className: 'card-grid' }, ...inSeason.map(packCard))]
        : []),
      el('h2', { className: 'section-label' }, 'Anytime favorites'),
      el('div', { className: 'card-grid' }, ...evergreen.map(packCard)),
    ),
  );
}
