import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { getSettings, saveSettings } from '../../storage/settings.ts';

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];

interface KidTheme {
  key: string;
  title: string;
  emoji: string;
  /** Months when this theme is "in season" (empty = evergreen). */
  months: number[];
  /** Grade bands that see it (all if empty). */
  bands?: ('K2' | '35' | '68')[];
}

const KID_THEMES: KidTheme[] = [
  // Seasonal & events
  { key: 'summer', title: 'Summer Splash', emoji: '🌞', months: [6, 7, 8] },
  { key: 'olympics', title: 'Olympics', emoji: '🥇', months: [] },
  { key: 'worldcup', title: 'World Cup', emoji: '⚽', months: [] },
  { key: 'election', title: 'Election Time', emoji: '🗳️', months: [], bands: ['35', '68'] },
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

function bandFor(grade: string): 'K2' | '35' | '68' {
  if (grade === 'K' || grade === '1' || grade === '2') return 'K2';
  if (grade === '3' || grade === '4' || grade === '5') return '35';
  return '68';
}

export function renderKids(root: HTMLElement, _ctx: RouteCtx): void {
  let grade = getSettings().kidsGrade || 'K';

  const gradeRow = el('div', { className: 'picker-row' });
  const themeGrid = el('div', { className: 'card-grid kids-grid' });

  const renderAll = (): void => {
    gradeRow.replaceChildren(
      ...GRADES.map((g) => {
        const chip = el('button', { className: `chip ${g === grade ? 'active' : ''}` },
          g === 'K' ? 'Kindergarten' : `Grade ${g}`);
        chip.addEventListener('click', () => {
          grade = g;
          saveSettings({ kidsGrade: g });
          renderAll();
        });
        return chip;
      }),
    );

    const month = new Date().getMonth() + 1;
    const band = bandFor(grade);
    const visible = KID_THEMES.filter((t) => !t.bands || t.bands.includes(band));
    visible.sort((a, b) => Number(b.months.includes(month)) - Number(a.months.includes(month)));

    themeGrid.replaceChildren(
      ...visible.map((theme) => {
        const card = el('button', { className: 'mode-card card kids-card' },
          el('span', { className: 'kids-emoji' }, theme.emoji),
          el('h3', {}, theme.title),
          theme.months.includes(month) ? el('span', { className: 'chip active' }, 'In season!') : '',
        );
        card.addEventListener('click', () => {
          const seed = Math.floor(Math.random() * 1e9).toString(36);
          navigate(`puzzle/gen?mode=kids&grade=${grade}&theme=${encodeURIComponent(theme.key)}&seed=${seed}`);
        });
        return card;
      }),
    );
  };

  renderAll();
  root.append(
    el('div', { className: 'view-pad kids-view' },
      el('h1', { className: 'view-title' }, 'Kids Corner'),
      el('p', { className: 'view-sub' }, 'Pick your grade, pick a theme, get a mini made just for you. Maximum rainbow guaranteed. 🐬'),
      el('span', { className: 'field-label' }, 'Who’s solving?'),
      gradeRow,
      el('span', { className: 'field-label' }, 'Pick a theme'),
      themeGrid,
    ),
  );
}
