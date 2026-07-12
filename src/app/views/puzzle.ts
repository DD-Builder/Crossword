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
import { playGridMorphIn } from '../../ui/celebrations/gridWave.ts';
import { createKnob } from '../../ui/knob.ts';
import type { Puzzle } from '../../core/types.ts';

/** The knob-rack "baseline" — the values shown/adjusted, derived either from
 * a generated puzzle's own query string or (for a daily/mini/library puzzle,
 * which carries no such query) from the loaded Puzzle's own settings. */
interface TuneBaseline {
  mode: string;
  size: number;
  difficulty: number;
  register: string;
  theme?: string;
}

function tuneBaselineFor(puzzle: Puzzle, query: URLSearchParams | null): TuneBaseline {
  if (query) {
    const mode = query.get('mode') ?? 'free';
    return {
      mode,
      size: Number(query.get('size') ?? puzzle.size.rows),
      difficulty: mode === 'kids' ? 0 : Number(query.get('difficulty') ?? puzzle.difficulty),
      register: query.get('register') ?? getSettings().clueRegister,
      theme: query.get('theme') ?? undefined,
    };
  }
  // Daily / mini / library puzzle: it has no generation query at all — derive
  // starting knob positions from the puzzle itself. It is never mutated;
  // touching a knob detaches into a fresh Free Play puzzle (see retune()).
  return {
    mode: 'free',
    size: puzzle.size.rows,
    difficulty: puzzle.kind === 'kids' ? 0 : Math.min(7, Math.max(1, Math.round(puzzle.difficulty))),
    register: getSettings().clueRegister,
  };
}

export function renderPuzzle(root: HTMLElement, ctx: RouteCtx): (() => void) | void {
  const container = el('div', { className: 'solver' });
  root.append(container);
  container.append(el('div', { className: 'solver-loading' }, 'Constructing your puzzle…'));

  let cleanup: (() => void) | null = null;
  let cancelled = false;
  let retuning = false;
  let currentPuzzle: Puzzle | null = null;
  // Persisted across in-place retunes (which fully remount the tune rack) so
  // fiddling with several knobs in a row doesn't re-close the panel each time.
  let tuneOpen = false;

  const speedMode = ctx.query.get('speed') === '1';
  // Generated puzzles retune in place; daily/mini/library ones detach into a
  // fresh generated puzzle the moment a knob is touched (see retune()) — both
  // paths share the same knob rack, just wired differently underneath.
  const isGen = ctx.params[0] === 'gen' && !speedMode;
  const query = new URLSearchParams(ctx.query.toString());
  // A puzzle just detached from a daily carries this marker for one mount, so
  // it gets the nice cell-cascade morph-in instead of appearing flat.
  const cameFromDaily = query.get('fromDaily') === '1';
  if (cameFromDaily) query.delete('fromDaily');

  function mount(puzzle: Puzzle, morph: boolean): void {
    currentPuzzle = puzzle;
    container.replaceChildren();
    cleanup = mountSolver(container, puzzle, {
      speedMode, morph,
      ...(speedMode ? {} : {
        tuneBaseline: tuneBaselineFor(puzzle, isGen ? query : null),
        tuneAttached: isGen,
        tuneOpen,
        onTuneToggle: (open: boolean) => { tuneOpen = open; },
        retune: (patch) => void retune(patch),
      }),
    });
  }

  async function retune(patch: Record<string, string>): Promise<void> {
    if (retuning || !currentPuzzle) return;
    retuning = true;
    container.classList.add('retuning');
    try {
      if (isGen) {
        for (const [k, v] of Object.entries(patch)) query.set(k, v);
        query.set('seed', Math.random().toString(36).slice(2)); // a fresh grid each time
        const next = await resolvePuzzle({ ...ctx, params: ['gen'], query });
        if (cancelled) return;
        cleanup?.();
        mount(next, true);
      } else {
        // Build a fresh generated-puzzle query from the daily's own baseline,
        // apply the knob change, and navigate — a full route change, so the
        // puzzle's kind/title genuinely switches to Free Play (or Kids) and
        // the original daily is left completely untouched for everyone else.
        const base = tuneBaselineFor(currentPuzzle, null);
        const params = new URLSearchParams({
          mode: base.mode, size: String(base.size), difficulty: String(base.difficulty),
          register: base.register, ...(base.theme ? { theme: base.theme } : {}),
        });
        for (const [k, v] of Object.entries(patch)) params.set(k, v);
        params.set('seed', Math.random().toString(36).slice(2));
        params.set('fromDaily', '1');
        navigate(`puzzle/gen?${params.toString()}`);
      }
    } catch {
      toast('Could not build that combo — try another.');
    } finally {
      container.classList.remove('retuning');
      retuning = false;
    }
  }

  resolvePuzzle(ctx)
    .then((puzzle) => {
      if (cancelled) return;
      mount(puzzle, cameFromDaily);
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

const DIFFICULTY_KNOB_LABELS = ['Kids', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SIZE_KNOB_VALUES = [5, 7, 9, 11, 13, 15, 17, 19, 21];
const REGISTER_KNOB_VALUES = ['classic', 'modern'];

/** The in-puzzle "Tune" panel: amplifier-style knobs that regenerate the
 * puzzle live. Shown for every non-speed puzzle — generated or daily/mini/
 * library alike (see tuneBaselineFor / retune() for how the two differ). */
function buildTuneRack(
  baseline: TuneBaseline,
  retune: (patch: Record<string, string>) => void,
  attached: boolean,
  open: boolean,
  onToggle: (open: boolean) => void,
): HTMLElement {
  const isKids = baseline.difficulty === 0;

  const diffKnob = createKnob({
    label: 'Difficulty',
    positions: DIFFICULTY_KNOB_LABELS,
    index: baseline.difficulty,
    onChange: (i) => {
      if (i === 0) retune({ mode: 'kids', theme: baseline.theme ?? 'animals' });
      else retune({ mode: baseline.mode === 'kids' ? 'free' : baseline.mode, difficulty: String(i) });
    },
  });

  const sizeIdx = Math.max(0, SIZE_KNOB_VALUES.indexOf(baseline.size));
  const sizeKnob = createKnob({
    label: 'Size',
    positions: SIZE_KNOB_VALUES.map((s) => `${s}×${s}`),
    index: sizeIdx,
    disabled: isKids,
    onChange: (i) => retune({ size: String(SIZE_KNOB_VALUES[i]) }),
  });

  const registerIdx = Math.max(0, REGISTER_KNOB_VALUES.indexOf(baseline.register));
  const registerKnob = createKnob({
    label: 'Clue style',
    positions: ['Classic', 'Modern'],
    index: registerIdx,
    disabled: isKids,
    onChange: (i) => retune({ register: REGISTER_KNOB_VALUES[i]! }),
  });

  const hint = attached
    ? 'Adjust and the puzzle rebuilds live.'
    : 'Adjust and the puzzle rebuilds live — this switches from Daily to Free Play (today\'s Daily stays untouched).';
  const panel = el('div', { className: `retune-panel${open ? ' open' : ''}` },
    el('p', { className: 'retune-hint' }, hint),
    diffKnob.root, sizeKnob.root, registerKnob.root,
  );
  const toggle = el('button', { className: 'btn quiet retune-toggle' }, '🎛️ Tune this puzzle');
  toggle.addEventListener('click', () => {
    const next = !panel.classList.contains('open');
    panel.classList.toggle('open', next);
    onToggle(next);
  });
  return el('div', { className: 'retune-bar' }, toggle, panel);
}

interface MountOpts {
  speedMode?: boolean;
  /** Play a cascade-in when this mount is a retune (not the first load). */
  morph?: boolean;
  /** Starting knob positions for the tune rack. */
  tuneBaseline?: TuneBaseline;
  /** Whether we're already in a generated puzzle (in-place retune) vs. a
   * daily/mini/library one (a knob touch detaches into Free Play). */
  tuneAttached?: boolean;
  /** Whether the tune panel should render already open (persisted across an
   * in-place retune's full remount, so it doesn't re-close on every turn). */
  tuneOpen?: boolean;
  onTuneToggle?: (open: boolean) => void;
  /** Regenerate/detach the puzzle with a patch of knob values. */
  retune?: (patch: Record<string, string>) => void;
}

function mountSolver(container: HTMLElement, puzzle: Puzzle, opts: MountOpts = {}): () => void {
  const speedMode = opts.speedMode ?? false;
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

  // In-puzzle "Tune" panel: knobs for size/difficulty/clue style. On a
  // generated puzzle they regenerate in place; on a daily/mini/library one,
  // touching a knob detaches into a fresh Free Play puzzle (see puzzle.ts
  // retune()) — the shared daily itself is never mutated.
  const retuneBar = opts.retune && opts.tuneBaseline
    ? buildTuneRack(
        opts.tuneBaseline, opts.retune, opts.tuneAttached ?? false,
        opts.tuneOpen ?? false, opts.onTuneToggle ?? (() => {}),
      )
    : null;

  const gridWrap = el('div', { className: 'grid-pane' },
    ...(retuneBar ? [retuneBar] : []),
    ...(speedHud ? [speedHud] : []), clueBar.root, grid.root);
  const main = el('div', { className: 'solver-main' }, gridWrap, clueLists.root);
  container.append(toolbar.root, main, softKbd.root);

  if (opts.morph) requestAnimationFrame(() => playGridMorphIn(grid.root));

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
        // Blur the whole puzzle behind the celebration so it reads cleanly.
        container.classList.add('solved-blur');
        victory = celebrate(session, milestones, grid.root, container);
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
  container: HTMLElement,
): { stop(): void } {
  const ms = session.activeMs();
  const puzzle = session.puzzle;
  const unblur = () => container.classList.remove('solved-blur');
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
            el('button', { className: 'btn', onclick: () => { unblur(); close(); navigate('stats'); } }, 'See stats'),
            el('button', { className: 'btn primary', onclick: () => { unblur(); close(); navigate(''); } }, 'Done'),
          ),
        );
        // Button-only: dismissing by tapping the backdrop would strand a blurred
        // puzzle with no card. The puzzle stays blurred behind the see-through
        // card until an action is taken.
      }, { dismissable: false, ...(animated ? { backdropClass: 'celebrate-backdrop' } : {}) });
    },
  });
}
