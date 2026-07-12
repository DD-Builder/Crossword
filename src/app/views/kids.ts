import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';

interface KidTheme {
  key: string;
  title: string;
  emoji: string;
  /** Months when this theme is "in season" (empty = evergreen). */
  months: number[];
}

const KID_THEMES: KidTheme[] = [
  // Seasonal & events
  { key: 'summer', title: 'Summer Splash', emoji: '🌞', months: [6, 7, 8] },
  { key: 'olympics', title: 'Olympics', emoji: '🥇', months: [] },
  { key: 'worldcup', title: 'World Cup', emoji: '⚽', months: [] },
  { key: 'election', title: 'Election Time', emoji: '🗳️', months: [] },
  { key: 'halloween', title: 'Spooky Season', emoji: '👻', months: [10] },
  { key: 'thanksgiving', title: 'Turkey Day', emoji: '🦃', months: [11] },
  { key: 'christmas', title: 'Winter Holidays', emoji: '⛄', months: [12] },
  { key: 'spring', title: 'Spring Things', emoji: '🌈', months: [3, 4, 5] },
  // Fun categories
  { key: 'videogames', title: 'Video Games', emoji: '🎮', months: [] },
  { key: 'wildflowers', title: 'Wildflowers', emoji: '🌼', months: [] },
  { key: 'dinosaurs', title: 'Dinosaurs', emoji: '🦕', months: [] },
  { key: 'space', title: 'Outer Space', emoji: '🚀', months: [] },
  { key: 'ocean', title: 'Under the Sea', emoji: '🐬', months: [] },
  { key: 'animals', title: 'Animal Kingdom', emoji: '🦁', months: [] },
  // Curriculum-ish
  { key: 'math', title: 'Math Magic', emoji: '➗', months: [] },
  { key: 'reading', title: 'Book Nook', emoji: '📚', months: [] },
  { key: 'school', title: 'School Days', emoji: '✏️', months: [] },
  { key: 'weather', title: 'Wild Weather', emoji: '🌩️', months: [] },
];

/** Kids Corner is one general-audience level (see WEEKDAY_KNOBS[0]) — no
 * grade or difficulty picker. Pick a theme and go; the in-puzzle tune knobs
 * can always dial into Monday+ difficulty from there if a player wants more. */
export function renderKids(root: HTMLElement, _ctx: RouteCtx): void {
  const month = new Date().getMonth() + 1;
  const themes = [...KID_THEMES].sort((a, b) =>
    Number(b.months.includes(month)) - Number(a.months.includes(month)));

  const themeGrid = el('div', { className: 'card-grid kids-grid' },
    ...themes.map((theme) => {
      const card = el('button', { className: 'mode-card card kids-card' },
        el('span', { className: 'kids-emoji' }, theme.emoji),
        el('h3', {}, theme.title),
        theme.months.includes(month) ? el('span', { className: 'chip active' }, 'In season!') : '',
      );
      card.addEventListener('click', () => {
        const seed = Math.floor(Math.random() * 1e9).toString(36);
        navigate(`puzzle/gen?mode=kids&theme=${encodeURIComponent(theme.key)}&seed=${seed}`);
      });
      return card;
    }),
  );

  root.append(
    el('div', { className: 'view-pad kids-view' },
      el('h1', { className: 'view-title' }, 'Kids Corner'),
      el('p', { className: 'view-sub' }, 'Pick a theme, get a mini made just for you. Maximum rainbow guaranteed. 🐬'),
      el('span', { className: 'field-label' }, 'Pick a theme'),
      themeGrid,
    ),
  );
}
