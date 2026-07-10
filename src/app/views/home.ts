import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { todayIso } from '../puzzles.ts';
import { weekdayOf } from '../../core/generator/difficulty.ts';
import { getStreak, hasProgress } from '../../solve/progress.ts';
import { loadJson } from '../../storage/settings.ts';

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DIFFICULTY_TAGS = ['', 'gentle', 'easygoing', 'crafty', 'tricky', 'devious', 'diabolical', 'grand & themed'];

export function renderHome(root: HTMLElement, _ctx: RouteCtx): (() => void) | void {
  const date = todayIso();
  const weekday = weekdayOf(date);
  const streak = getStreak();
  const done = loadJson<Record<string, string[]>>('completedDailies', {});
  const doneToday = new Set(done[date] ?? []);

  const pretty = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // A little card factory. `accent` is a decorative hue (not a skin token) that
  // tints the icon chip, top ribbon, and hover glow — that's the "life" the flat
  // grid was missing. It's color-mixed with --surface everywhere so it still sits
  // right on every skin, light or dark.
  const card = (
    opts: { icon: string; accent: string; kicker: string; title: string; blurb: string;
            path: string; meta?: HTMLElement; extra?: string },
  ): HTMLElement => {
    const node = el('button', { className: `mode-card card${opts.extra ? ` ${opts.extra}` : ''}` },
      el('div', { className: 'card-head' },
        el('span', { className: 'card-icon', 'aria-hidden': 'true' }, opts.icon),
        el('span', { className: 'mode-kicker' }, opts.kicker),
      ),
      el('h3', {}, opts.title),
      el('p', {}, opts.blurb),
      ...(opts.meta ? [opts.meta] : []),
    );
    node.style.setProperty('--card-accent', opts.accent);
    node.addEventListener('click', () => navigate(opts.path));
    return node;
  };

  const dailyCard = (
    kind: 'daily' | 'mini', title: string, blurb: string, icon: string, accent: string,
  ): HTMLElement => {
    const id = `${kind}-${date}`;
    const isDone = doneToday.has(kind);
    const inProgress = !isDone && hasProgress(id);
    const size = kind === 'daily' ? (weekday === 7 ? '21×21' : '15×15') : (weekday >= 6 ? '7×7' : '5×5');
    const meta = el('div', { className: 'mode-meta' },
      isDone
        ? el('span', { className: 'done-badge' }, '✓ Solved')
        : el('span', { className: 'chip chip-go' }, inProgress ? 'Continue →' : 'Play →'),
      el('span', { className: 'chip' }, size),
    );
    return card({
      icon, accent, kicker: `${WEEKDAY_NAMES[weekday]} · ${DIFFICULTY_TAGS[weekday]}`,
      title, blurb, path: `puzzle/${id}`, meta, extra: 'daily-card',
    });
  };

  root.append(
    el('div', { className: 'view-pad home' },
      el('div', { className: 'home-hero' },
        el('img', { className: 'home-logo', src: `${import.meta.env.BASE_URL}icons/favicon.svg`, alt: '' }),
        el('div', { className: 'home-hero-text' },
          el('span', { className: 'home-eyebrow' }, 'RIDDLE CROSSWORD'),
          el('h1', { className: 'view-title' }, 'Today'),
          el('span', { className: 'home-date' }, pretty),
        ),
        streak.current > 0
          ? el('span', { className: 'streak-flame' }, `🔥 ${streak.current}-day streak`)
          : '',
      ),
      el('div', { className: 'daily-grid' },
        dailyCard('daily', 'The Daily', 'The main event. Difficulty climbs all week — Monday warm-up to the big Sunday themer.', '📅', 'var(--accent)'),
        dailyCard('mini', 'The Mini', 'A tidy little grid for the coffee line. Same daily ramp, minutes not hours.', '☕', '#2f9e8f'),
      ),
      el('h2', { className: 'section-label' }, 'More ways to play'),
      el('div', { className: 'mode-grid' },
        card({ icon: '🎲', accent: '#6d5ae0', kicker: 'Pick your fight', title: 'Free Play',
          blurb: 'Any size, any difficulty, endless fresh grids from the engine.', path: 'free' }),
        card({ icon: '🎯', accent: '#d98324', kicker: 'Occasions & obsessions', title: 'Themed',
          blurb: 'Seasonal specials, or type any topic and get a puzzle built around it.', path: 'themed' }),
        card({ icon: '🦄', accent: '#d84f9c', kicker: 'Rainbows & dolphins', title: 'Kids Corner',
          blurb: 'Grade-tuned minis in glorious 90s Trapper-Keeper technicolor.', path: 'kids' }),
        card({ icon: '⚡', accent: '#d0453e', kicker: 'Race the clock', title: 'Speed Challenge',
          blurb: 'Today’s mini against par time and your personal-best ghost.', path: `puzzle/mini-${date}?speed=1` }),
      ),
    ),
  );
}
