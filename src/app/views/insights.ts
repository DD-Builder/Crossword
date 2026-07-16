import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { sparkline } from '../../ui/sparkline.ts';
import { tile, bar } from '../../ui/statBits.ts';
import { formatMs } from '../../ui/toolbar.ts';
import { insightsData, type InsightsData, type ClueMissStat } from '../../stats/insights.ts';
import { adaptiveSnapshot, ELO_MIN_CLUES } from '../../stats/adaptive.ts';
import { TIER_NAMES } from './stats.ts';

export function renderInsights(root: HTMLElement, _ctx: RouteCtx): void {
  const pad = el('div', { className: 'view-pad' },
    el('button', { className: 'btn quiet', style: 'padding-left:0', onclick: () => navigate('stats') }, '← Stats'),
    el('h1', { className: 'view-title' }, 'Player Insights'),
    el('p', { className: 'view-sub' }, 'Crunching your numbers…'),
  );
  root.append(pad);

  void insightsData(new Date()).then((data) => {
    pad.replaceChildren(
      el('button', { className: 'btn quiet', style: 'padding-left:0', onclick: () => navigate('stats') }, '← Stats'),
      el('h1', { className: 'view-title' }, 'Player Insights'),
      data.ratedClues === 0
        ? el('p', { className: 'view-sub' }, 'Solve a few clues and this page comes alive.')
        : renderBody(data),
    );
  });
}

function movementBadge(label: string, m: InsightsData['movement7d']): HTMLElement | null {
  if (!m) return null;
  const cls = m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : 'flat';
  const sign = m.delta > 0 ? '+' : '';
  return el('span', { className: `insight-movement ${cls}` }, `${sign}${m.delta} ${label}`);
}

function renderBody(data: InsightsData): HTMLElement {
  const snap = adaptiveSnapshot();

  const ratingSection = snap.rated
    ? el('div', { className: 'insight-card card' },
        el('div', { className: 'row-title' },
          el('span', { className: 'insight-score' }, `${data.currentScore}/100`),
          el('span', { className: 'lbl' }, `${TIER_NAMES[snap.tier]} · ${snap.tier}/5`),
          ...[movementBadge('7d', data.movement7d), movementBadge('30d', data.movement30d)].filter((x): x is HTMLElement => x !== null),
        ),
        sparkline(data.sampledScores, { baseline: 50, min: 0, max: 100 }),
        el('p', { className: 'muted', style: 'font-size:0.8rem; margin:4px 0 0' },
          'Solver Score, 0–100 — 50 is where everyone starts. This is what Free Play tunes to.'),
      )
    : el('div', { className: 'insight-card card' },
        bar('Rating progress', data.ratedClues, ELO_MIN_CLUES, `${data.ratedClues}/${ELO_MIN_CLUES} clues rated`),
        el('p', { className: 'muted', style: 'font-size:0.85rem; margin:8px 0 0' },
          'Solve a few more clues and your rating trend, movement, and Solver Score appear here.'),
      );

  return el('div', {},
    ratingSection,

    el('h2', { className: 'section-label' }, 'Clue styles — best & worst'),
    el('p', { className: 'muted', style: 'font-size:0.85rem; margin:0 0 8px' },
      'A heuristic read of clue phrasing (quoted/pop-culture, fill-in-the-blank, wordplay winks, abbreviations, straight definitions) — not a hand-tagged mechanic.'),
    ...(data.styles.length > 0
      ? data.styles.map((s) => bar(
          s.label, s.seen, Math.max(...data.styles.map((x) => x.seen)),
          `${Math.round(s.cleanRate * 100)}% clean`,
        ))
      : [el('p', { className: 'muted', style: 'font-size:0.85rem' }, 'Solve more clues to see this breakdown.')]),

    ...(data.missList.worst.length > 0 ? [
      el('h2', { className: 'section-label' }, 'Clues you miss most'),
      el('p', { className: 'muted', style: 'font-size:0.85rem; margin:0 0 8px' },
        'Clues you’ve seen at least twice, ranked by how often they trip you up.'),
      ...data.missList.worst.map((s) => missRow(s, `${Math.round(s.missRate * 100)}% missed`)),
    ] : []),

    ...(data.missList.best.length > 0 ? [
      el('h2', { className: 'section-label' }, 'Clues you nail every time'),
      ...data.missList.best.map((s) => missRow(s, formatMs(s.medianMs))),
    ] : []),

    ...(!snap.rated ? [
      el('h2', { className: 'section-label' }, 'By the numbers so far'),
      tile(String(data.ratedClues), 'clues rated'),
    ] : []),
  );
}

function missRow(s: ClueMissStat, statText: string): HTMLElement {
  return el('div', { className: 'miss-row' },
    el('span', { className: 'miss-clue' }, `${s.clue} — ${s.answer}`),
    el('span', { className: 'miss-stat' }, `${statText} · seen ${s.seen}×`),
  );
}
