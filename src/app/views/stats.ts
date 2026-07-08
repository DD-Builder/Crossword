import type { RouteCtx } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { dashboardData, type DashboardData } from '../../stats/metrics.ts';
import { getStreak } from '../../solve/progress.ts';
import { formatMs } from '../../ui/toolbar.ts';
import { HINT_TIERS } from '../../solve/hints.ts';
import { adaptiveSnapshot } from '../../stats/adaptive.ts';

const WEEKDAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIER_NAMES = ['', 'gentle', 'easygoing', 'crafty', 'tricky', 'devious'];

export function renderStats(root: HTMLElement, _ctx: RouteCtx): void {
  const pad = el('div', { className: 'view-pad' },
    el('h1', { className: 'view-title' }, 'Stats'),
    el('p', { className: 'view-sub' }, 'Crunching your numbers…'),
  );
  root.append(pad);

  void dashboardData().then((data) => {
    pad.replaceChildren(
      el('h1', { className: 'view-title' }, 'Stats'),
      data.totalSolves === 0
        ? el('p', { className: 'view-sub' }, 'Solve your first puzzle and this page comes alive.')
        : renderDashboard(data),
    );
  });
}

function tile(num: string, label: string): HTMLElement {
  return el('div', { className: 'stat-tile card' },
    el('span', { className: 'num' }, num),
    el('span', { className: 'lbl' }, label),
  );
}

function bar(label: string, value: number, max: number, display: string): HTMLElement {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return el('div', { className: 'bar-row' },
    el('span', {}, label),
    el('span', { className: 'bar-track' },
      el('span', { className: 'bar-fill', style: `width: ${pct}%` }),
    ),
    el('span', { className: 'bar-val' }, display),
  );
}

function renderDashboard(data: DashboardData): HTMLElement {
  const streak = getStreak();

  const weekdayMax = Math.max(...data.byWeekday.map((w) => w.count), 1);
  const catMax = Math.max(...data.categories.map((c) => c.seen), 1);
  const hintMax = Math.max(...data.hintTierUsage, 1);

  const snap = adaptiveSnapshot();

  return el('div', {},
    el('div', { className: 'stat-tiles' },
      tile(String(data.totalSolves), 'puzzles solved'),
      tile(String(data.totalFlawless), 'flawless solves'),
      tile(`${streak.current}🔥`, 'current streak'),
      tile(String(streak.best), 'best streak'),
      tile(formatMs(data.totalTimeMs), 'time puzzling'),
      tile(data.avgStars.toFixed(1) + '★', 'avg puzzle craft'),
    ),

    // The adaptive engine's current read on you — Free Play tunes to this.
    snap.rated
      ? el('div', { className: 'stat-tiles' },
          tile(`${TIER_NAMES[snap.tier]} · ${snap.tier}/5`, 'your Free Play level'),
          tile(`${Math.round(snap.recentSuccess * 100)}%`, 'recent clean rate'),
        )
      : el('p', { className: 'muted', style: 'font-size:0.85rem; margin:4px 0 0' },
          'Solve a few more Free Play puzzles and your adaptive level appears here.'),

    el('h2', { className: 'section-label' }, 'By weekday difficulty'),
    ...data.byWeekday
      .filter((w) => w.weekday >= 1 && w.count > 0)
      .map((w) => bar(
        WEEKDAY_SHORT[w.weekday]!,
        w.count,
        weekdayMax,
        `${w.count} · ${formatMs(w.medianMs)}`,
      )),

    el('h2', { className: 'section-label' }, 'Trivial Pursuit categories'),
    el('p', { className: 'muted', style: 'font-size:0.85rem; margin:0 0 8px' },
      'Clean rate = solved without wrong letters or reveals. This is what the adaptive engine reads.'),
    ...data.categories.map((c) => bar(
      c.label,
      c.seen,
      catMax,
      `${Math.round(c.cleanRate * 100)}% clean`,
    )),

    ...(data.bySize.length > 0 ? [
      el('h2', { className: 'section-label' }, 'By grid size'),
      ...data.bySize.map((s) => bar(
        `${s.size}×${s.size}`,
        s.count,
        Math.max(...data.bySize.map((x) => x.count)),
        `best ${formatMs(s.bestMs)}`,
      )),
    ] : []),

    ...(data.hintTierUsage.some((n) => n > 0) ? [
      el('h2', { className: 'section-label' }, 'Professor Down’s ledger'),
      ...HINT_TIERS.map((tier) => bar(
        tier.label,
        data.hintTierUsage[tier.tier] ?? 0,
        hintMax,
        String(data.hintTierUsage[tier.tier] ?? 0),
      )),
    ] : []),

    ...(data.recentSolves.length > 0 ? [
      el('h2', { className: 'section-label' }, 'Recent solves'),
      el('div', {},
        ...data.recentSolves.map((s) => el('div', { className: 'settings-row' },
          el('div', { className: 'grow' },
            el('div', { className: 'row-title' }, s.title),
            el('div', { className: 'row-sub' }, `${s.size}×${s.size} · ${s.date}${s.flawless ? ' · flawless' : ''}`),
          ),
          el('span', { className: 'muted', style: 'font-variant-numeric: tabular-nums' }, formatMs(s.activeMs)),
        )),
      ),
    ] : []),
  );
}
