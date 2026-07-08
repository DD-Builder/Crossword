/** The solver view: toolbar + clue bar + grid + clue columns + soft
 * keyboard, all driven by one SolveSession. Route:
 *   #/puzzle/<puzzleId>            library or daily puzzle
 *   #/puzzle/gen?...               generated (free play, themed, kids)
 */

import type { RouteCtx } from '../router.ts';
import { navigate } from '../router.ts';
import { el, openModal, toast } from '../../ui/dom.ts';
import { SolveSession } from '../../solve/session.ts';
import { attachKeyboard } from '../../ui/keys.ts';
import { createGridView } from '../../ui/gridView.ts';
import { createClueBar, createClueLists } from '../../ui/clueViews.ts';
import { createSoftKeyboard } from '../../ui/softKeyboard.ts';
import { createToolbar, formatMs } from '../../ui/toolbar.ts';
import { getSettings } from '../../storage/settings.ts';
import { resolvePuzzle } from '../puzzles.ts';
import { openHintLadder } from '../../solve/hintUi.ts';
import { onSolveComplete, restoreProgress, persistProgress, clearProgress } from '../../solve/progress.ts';
import { getSpeedPb, makeGhost, maybeSaveSpeedPb, parMsFor } from '../../solve/speed.ts';
import { shareSolve } from '../../ui/share.ts';
import { playVictory } from '../../ui/celebrations/index.ts';
import type { Puzzle } from '../../core/types.ts';

export function renderPuzzle(root: HTMLElement, ctx: RouteCtx): (() => void) | void {
  const container = el('div', { className: 'solver' });
  root.append(container);
  container.append(el('div', { className: 'solver-loading' }, 'Constructing your puzzle…'));

  let cleanup: (() => void) | null = null;
  let cancelled = false;

  const speedMode = ctx.query.get('speed') === '1';

  resolvePuzzle(ctx)
    .then((puzzle) => {
      if (cancelled) return;
      container.replaceChildren();
      cleanup = mountSolver(container, puzzle, speedMode);
    })
    .catch((err: unknown) => {
      if (cancelled) return;
      container.replaceChildren(
        el('div', { className: 'solver-loading' },
          el('p', {}, 'Could not build that puzzle.'),
          el('p', { className: 'muted' }, err instanceof Error ? err.message : String(err)),
          el('button', { className: 'btn primary', onclick: () => navigate('') }, 'Back home'),
        ),
      );
    });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}

function mountSolver(container: HTMLElement, puzzle: Puzzle, speedMode = false): () => void {
  const settings = getSettings();
  const session = new SolveSession(puzzle, { autocheck: settings.autocheck });
  if (!speedMode) restoreProgress(session); // speed runs always start clean

  // Kids puzzles auto-apply the Lisa Frank skin for the duration.
  const isKids = puzzle.kind === 'kids';
  const prevSkin = document.documentElement.dataset.skin;
  if (isKids) document.documentElement.dataset.skin = 'lisa-frank';

  let pauseOverlay: { close(): void } | null = null;
  const togglePause = (): void => {
    const state = session.store.get();
    if (state.completed) return;
    if (state.paused) {
      session.resume();
      pauseOverlay?.close();
      pauseOverlay = null;
    } else {
      session.pause();
      pauseOverlay = openModal((body) => {
        body.append(
          el('h3', {}, 'Paused'),
          el('p', { className: 'muted' }, 'The clock is stopped. No peeking — the grid is hidden.'),
          el('button', { className: 'btn primary', onclick: () => togglePause() }, 'Resume'),
        );
      }, { dismissable: false });
    }
  };

  const toolbar = createToolbar(session, {
    onBack: () => navigate(''),
    onPauseToggle: togglePause,
    onHint: () => openHintLadder(session),
  });
  const clueBar = createClueBar(session);
  const grid = createGridView(session);
  const clueLists = createClueLists(session);
  const softKbd = createSoftKeyboard(session);

  // Speed HUD: par countdown + PB ghost progress.
  const parMs = speedMode ? parMsFor(puzzle) : 0;
  const pb = speedMode ? getSpeedPb(puzzle) : null;
  const ghost = pb ? makeGhost(pb) : null;
  const speedHud = speedMode
    ? el('div', { className: 'speed-hud' },
        el('span', { className: 'speed-par' }, `Par ${formatMs(parMs)}`),
        el('span', { className: 'speed-track' },
          el('span', { className: 'speed-fill you', style: 'width:0%' }),
          ghost ? el('span', { className: 'speed-fill ghost', style: 'width:0%' }) : '',
        ),
        el('span', { className: 'speed-pb' }, ghost ? `PB ${formatMs(ghost.pbMs)}` : 'First run!'),
      )
    : null;

  const gridWrap = el('div', { className: 'grid-pane' },
    ...(speedHud ? [speedHud] : []), clueBar.root, grid.root);
  const main = el('div', { className: 'solver-main' }, gridWrap, clueLists.root);
  container.append(toolbar.root, main, softKbd.root);

  const keyboard = attachKeyboard(session, {
    onPauseToggle: togglePause,
    onHardwareKey: () => softKbd.hide(),
  });

  // Test hook (also handy in devtools): the active puzzle's shape.
  (window as unknown as { __xw?: object }).__xw = {
    solution: puzzle.grid,
    rows: puzzle.size.rows,
    cols: puzzle.size.cols,
  };

  // Timer tick — refresh the toolbar clock once a second while active.
  const totalCells = puzzle.grid.join('').replace(/#/g, '').length;
  const timerInterval = window.setInterval(() => {
    const state = session.store.get();
    if (state.paused || state.completed) return;
    toolbar.refresh();
    session.pollFire(); // let the streak fade even when no keys are pressed
    if (speedHud) {
      const t = session.activeMs();
      const you = speedHud.querySelector<HTMLElement>('.speed-fill.you');
      const filled = new Set(session.fillOrder.map((f) => f.index)).size;
      if (you) you.style.width = `${Math.min(100, (filled / totalCells) * 100)}%`;
      if (ghost) {
        const g = speedHud.querySelector<HTMLElement>('.speed-fill.ghost');
        if (g) g.style.width = `${Math.min(100, (ghost.filledAt(t) / Math.max(1, ghost.total)) * 100)}%`;
      }
      const par = speedHud.querySelector<HTMLElement>('.speed-par');
      if (par) {
        const left = parMs - t;
        par.textContent = left >= 0 ? `Par −${formatMs(left)}` : `Par +${formatMs(-left)}`;
        par.classList.toggle('over', left < 0);
      }
    }
  }, speedMode ? 250 : 1000);

  let congratulated = false;
  let victory: { stop(): void } | null = null;
  let persistTimer: number | null = null;
  const unsubscribe = session.store.subscribe((state) => {
    grid.refresh();
    clueBar.refresh();
    clueLists.refresh();
    toolbar.refresh();
    container.classList.toggle('is-paused', state.paused);

    // Throttled progress persistence.
    if (!state.completed && persistTimer === null) {
      persistTimer = window.setTimeout(() => {
        persistTimer = null;
        persistProgress(session);
      }, 800);
    }

    if (state.completed && !congratulated) {
      congratulated = true;
      clearProgress(session.puzzle.id);
      void onSolveComplete(session, speedMode ? { speedMode, parMs } : undefined).then((milestones) => {
        if (speedMode) {
          const ms = session.activeMs();
          const { improved, prev } = maybeSaveSpeedPb(session);
          if (ms <= parMs) milestones.unshift(`⚡ Beat par by ${formatMs(parMs - ms)}`);
          else milestones.unshift(`Par slipped by ${formatMs(ms - parMs)} — next time.`);
          if (improved) {
            milestones.unshift(prev
              ? `👻 New speed PB! Ghost beaten by ${formatMs(prev.ms - ms)}`
              : '👻 First speed record set — your ghost awaits.');
          }
        }
        victory = celebrate(session, milestones, grid.root);
      });
    }
  });

  // "Filled but wrong" nudge: check once whenever the grid first becomes full.
  let nudged = false;
  const nudgeUnsub = session.store.subscribe(() => {
    if (!nudged && session.filledButWrong()) {
      nudged = true;
      toast('Hmm — the grid is full, but something’s off…');
    }
    if (!session.filledButWrong()) nudged = false;
  });

  return () => {
    keyboard.detach();
    unsubscribe();
    nudgeUnsub();
    window.clearInterval(timerInterval);
    if (persistTimer !== null) window.clearTimeout(persistTimer);
    if (!session.store.get().completed) persistProgress(session);
    pauseOverlay?.close();
    victory?.stop();
    if (isKids && prevSkin) document.documentElement.dataset.skin = prevSkin;
  };
}

function celebrate(
  session: SolveSession,
  milestones: string[],
  gridEl: HTMLElement | null,
): { stop(): void } {
  const ms = session.activeMs();
  const puzzle = session.puzzle;
  return playVictory({
    seedKey: `${puzzle.id}|${puzzle.date ?? ''}`,
    gridEl,
    title: puzzle.title,
    timeText: formatMs(ms),
    onModalCue: (animated) => {
      openModal((body, close) => {
        body.classList.add('celebrate');
        body.append(
          // The canvas scene owns the spectacle; the CSS confetti only plays
          // when the scene was skipped (setting off / reduced motion).
          animated ? '' : el('div', { className: 'confetti', 'aria-hidden': 'true' },
            ...Array.from({ length: 24 }, (_, i) => el('i', { style: `--i:${i}` })),
          ),
          el('h3', {}, session.store.get().flawless ? 'Flawless! 🏆' : 'Solved! 🎉'),
          el('p', { className: 'celebrate-time' }, formatMs(ms)),
          el('ul', { className: 'milestones' }, ...milestones.map((m) => el('li', {}, m))),
          el('div', { className: 'modal-actions' },
            el('button', { className: 'btn', onclick: () => void shareSolve(session) }, 'Share'),
            el('button', { className: 'btn', onclick: () => { close(); navigate('stats'); } }, 'See stats'),
            el('button', { className: 'btn primary', onclick: () => { close(); navigate(''); } }, 'Done'),
          ),
        );
        // When the canvas spectacle is playing, keep the backdrop see-through
        // so the animation shows behind the card instead of being veiled.
      }, animated ? { backdropClass: 'celebrate-backdrop' } : {});
    },
  });
}
