import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { todayIso } from '../puzzles.ts';
import { loadJson } from '../../storage/settings.ts';

/** Puzzles reach back this far — before the app existed there's nothing. */
const EPOCH = '2026-01-01';

export function renderArchive(root: HTMLElement, _ctx: RouteCtx): void {
  const today = todayIso();
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7)); // 1-12

  const title = el('div', { className: 'cal-title' });
  const grid = el('div', { className: 'cal-grid' });

  const render = (): void => {
    const done = loadJson<Record<string, string[]>>('completedDailies', {});
    title.textContent = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long', year: 'numeric',
    });
    grid.replaceChildren(
      ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => el('div', { className: 'cal-dow' }, d)),
    );

    const first = new Date(year, month - 1, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first offset
    for (let i = 0; i < lead; i++) grid.append(el('div', { className: 'cal-day out' }));

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const future = iso > today;
      const preEpoch = iso < EPOCH;
      const kinds = new Set(done[iso] ?? []);
      const cell = el('button', {
        className: `cal-day ${future || preEpoch ? 'future' : ''} ${iso === today ? 'today' : ''}`,
      },
        el('span', {}, String(day)),
        el('span', { className: 'dots' },
          el('span', { className: `dot ${kinds.has('daily') ? 'done' : ''}` }),
          el('span', { className: `dot ${kinds.has('mini') ? 'done' : ''}` }),
        ),
      );
      if (!future && !preEpoch) {
        cell.addEventListener('click', () => openDay(iso, kinds));
      }
      grid.append(cell);
    }
  };

  const openDay = (iso: string, kinds: Set<string>): void => {
    import('../../ui/dom.ts').then(({ openModal }) => {
      openModal((body, close) => {
        const pretty = new Date(iso).toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        });
        body.append(
          el('h3', {}, pretty),
          el('div', { className: 'menu-list' },
            el('button', {
              className: 'menu-item',
              onclick: () => { close(); navigate(`puzzle/daily-${iso}`); },
            }, `The Daily ${kinds.has('daily') ? '· solved ✓' : ''}`),
            el('button', {
              className: 'menu-item',
              onclick: () => { close(); navigate(`puzzle/mini-${iso}`); },
            }, `The Mini ${kinds.has('mini') ? '· solved ✓' : ''}`),
          ),
        );
      });
    });
  };

  const prevBtn = el('button', { className: 'btn small' }, '‹');
  const nextBtn = el('button', { className: 'btn small' }, '›');
  prevBtn.addEventListener('click', () => {
    month--;
    if (month === 0) { month = 12; year--; }
    render();
  });
  nextBtn.addEventListener('click', () => {
    month++;
    if (month === 13) { month = 1; year++; }
    render();
  });

  render();
  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Archive'),
      el('p', { className: 'view-sub' }, 'Every daily since launch. Green dots: Daily · Mini.'),
      el('div', { className: 'cal-head' }, prevBtn, title, nextBtn),
      grid,
    ),
  );
}
