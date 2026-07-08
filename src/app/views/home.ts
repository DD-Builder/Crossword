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

  const dailyCard = (kind: 'daily' | 'mini', title: string, blurb: string): HTMLElement => {
    const id = `${kind}-${date}`;
    const isDone = doneToday.has(kind);
    const inProgress = !isDone && hasProgress(id);
    const card = el('button', { className: 'mode-card daily-card card' },
      el('span', { className: 'mode-kicker' }, `${WEEKDAY_NAMES[weekday]} · ${DIFFICULTY_TAGS[weekday]}`),
      el('h3', {}, title),
      el('p', {}, blurb),
      el('div', { className: 'mode-meta' },
        isDone
          ? el('span', { className: 'done-badge' }, '✓ Solved')
          : el('span', { className: 'chip' }, inProgress ? 'Continue' : 'Play'),
        kind === 'daily' ? el('span', { className: 'chip' }, '15×15') : el('span', { className: 'chip' }, weekday >= 6 ? '7×7' : '5×5'),
      ),
    );
    card.addEventListener('click', () => navigate(`puzzle/${id}`));
    return card;
  };

  const modeCard = (kicker: string, title: string, blurb: string, path: string): HTMLElement => {
    const card = el('button', { className: 'mode-card card' },
      el('span', { className: 'mode-kicker' }, kicker),
      el('h3', {}, title),
      el('p', {}, blurb),
    );
    card.addEventListener('click', () => navigate(path));
    return card;
  };

  root.append(
    el('div', { className: 'view-pad' },
      el('div', { className: 'home-hero' },
        el('h1', { className: 'view-title' }, 'Today'),
        el('span', { className: 'home-date' }, pretty),
        streak.current > 0 ? el('span', { className: 'streak-flame' }, `🔥 ${streak.current}-day streak`) : '',
      ),
      el('div', { className: 'card-grid' },
        dailyCard('daily', 'The Daily', 'The main event. Difficulty climbs all week — Monday warm-up to the big Sunday themer.'),
        dailyCard('mini', 'The Mini', 'A tidy little grid for the coffee line. Same daily ramp, minutes not hours.'),
      ),
      el('h2', { className: 'section-label' }, 'More ways to play'),
      el('div', { className: 'card-grid' },
        modeCard('Pick your fight', 'Free Play', 'Any size, any difficulty, endless fresh grids from the engine.', 'free'),
        modeCard('Occasions & obsessions', 'Themed', 'Seasonal specials, or type any topic and get a puzzle built around it.', 'themed'),
        modeCard('Rainbows & dolphins', 'Kids Corner', 'Grade-tuned minis in glorious 90s Trapper-Keeper technicolor.', 'kids'),
        modeCard('Race the clock', 'Speed Challenge', 'Today’s mini against par time and your personal-best ghost.', `puzzle/mini-${date}?speed=1`),
      ),
    ),
  );
}
