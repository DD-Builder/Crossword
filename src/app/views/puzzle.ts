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
import type { Puzzle } from '../../core/types.ts';

export function renderPuzzle(root: HTMLElement, ctx: RouteCtx): (() => void) | void {
  const container = el('div', { className: 'solver' });
  root.append(container);
  container.append(el('div', { className: 'solver-loading' }, 'Constructing your puzzle…'));

  let cleanup: (() => void) | null = null;
  let cancelled = false;

  resolvePuzzle(ctx)
    .then((puzzle) => {
      if (cancelled) return;
      container.replaceChildren();
      cleanup = mountSolver(container, puzzle);
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

function mountSolver(container: HTMLElement, puzzle: Puzzle): () => void {
  const settings = getSettings();
  const session = new SolveSession(puzzle, { autocheck: settings.autocheck });
  restoreProgress(session);

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

  const gridWrap = el('div', { className: 'grid-pane' }, clueBar.root, grid.root);
  const main = el('div', { className: 'solver-main' }, gridWrap, clueLists.root);
  container.append(toolbar.root, main, softKbd.root);

  const keyboard = attachKeyboard(session, {
    onPauseToggle: togglePause,
    onHardwareKey: () => softKbd.hide(),
  });

  // Timer tick — refresh the toolbar clock once a second while active.
  const timerInterval = window.setInterval(() => {
    const state = session.store.get();
    if (!state.paused && !state.completed) toolbar.refresh();
  }, 1000);

  let congratulated = false;
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
      void onSolveComplete(session).then((milestones) => celebrate(session, milestones));
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
    if (isKids && prevSkin) document.documentElement.dataset.skin = prevSkin;
  };
}

function celebrate(session: SolveSession, milestones: string[]): void {
  const ms = session.activeMs();
  openModal((body, close) => {
    body.classList.add('celebrate');
    body.append(
      el('div', { className: 'confetti', 'aria-hidden': 'true' },
        ...Array.from({ length: 24 }, (_, i) => el('i', { style: `--i:${i}` })),
      ),
      el('h3', {}, session.store.get().flawless ? 'Flawless! 🏆' : 'Solved! 🎉'),
      el('p', { className: 'celebrate-time' }, formatMs(ms)),
      el('ul', { className: 'milestones' }, ...milestones.map((m) => el('li', {}, m))),
      el('div', { className: 'modal-actions' },
        el('button', { className: 'btn', onclick: () => { close(); navigate('stats'); } }, 'See stats'),
        el('button', { className: 'btn primary', onclick: () => { close(); navigate(''); } }, 'Done'),
      ),
    );
  });
}
