/** Solver toolbar: timer, pencil toggle, check/reveal menus, hint button,
 * settings shortcuts. Dumb view over the SolveSession. */

import type { SolveSession } from '../solve/session.ts';
import { el, openModal } from './dom.ts';
import { getSettings, saveSettings } from '../storage/settings.ts';

export interface Toolbar {
  root: HTMLElement;
  refresh(): void;
}

export function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function createToolbar(
  session: SolveSession,
  hooks: {
    onBack: () => void;
    onPauseToggle: () => void;
    onHint: () => void;
  },
): Toolbar {
  const timerEl = el('button', { className: 'tb-timer', 'aria-label': 'Pause timer' }, '0:00');
  timerEl.addEventListener('click', hooks.onPauseToggle);

  const pencilBtn = el('button', { className: 'tb-btn', 'aria-label': 'Pencil mode', title: 'Pencil mode (.)' }, '✎');
  pencilBtn.addEventListener('click', () => session.togglePencilMode());

  const hintBtn = el('button', { className: 'tb-btn hint', 'aria-label': 'Hint' }, '💡');
  hintBtn.addEventListener('click', hooks.onHint);

  const checkBtn = el('button', { className: 'tb-btn', 'aria-label': 'Check menu' }, '✓');
  checkBtn.addEventListener('click', () => {
    openModal((body, close) => {
      const settings = getSettings();
      body.append(
        el('h3', {}, 'Check & Reveal'),
        el('div', { className: 'menu-list' },
          menuItem('Check letter', () => { session.checkLetter(); close(); }),
          menuItem('Check word', () => { session.checkWord(); close(); }),
          menuItem('Check puzzle', () => { session.checkPuzzle(); close(); }),
          el('hr'),
          menuItem(`Autocheck: ${settings.autocheck ? 'on' : 'off'}`, () => {
            const next = !getSettings().autocheck;
            saveSettings({ autocheck: next });
            session.setAutocheck(next);
            close();
          }),
          el('hr'),
          menuItem('Reveal letter', () => { session.revealLetter(); close(); }),
          menuItem('Reveal word', () => { session.revealWord(); close(); }),
          menuItem('Reveal puzzle…', () => {
            close();
            openModal((b2, c2) => {
              b2.append(
                el('h3', {}, 'Reveal everything?'),
                el('p', { className: 'muted' }, 'The puzzle will be marked as revealed — no going back.'),
                el('div', { className: 'modal-actions' },
                  el('button', { className: 'btn', onclick: c2 }, 'Keep solving'),
                  el('button', {
                    className: 'btn primary',
                    onclick: () => { session.revealPuzzle(); c2(); },
                  }, 'Reveal it all'),
                ),
              );
            });
          }),
        ),
      );
    });
  });

  const backBtn = el('button', { className: 'tb-btn back', 'aria-label': 'Back to home' }, '←');
  backBtn.addEventListener('click', hooks.onBack);

  const title = el('span', { className: 'tb-title' }, session.puzzle.title);

  const root = el('div', { className: 'solver-toolbar' },
    backBtn, title,
    el('div', { className: 'spacer' }),
    timerEl, pencilBtn, checkBtn, hintBtn,
  );

  function menuItem(label: string, action: () => void): HTMLElement {
    const b = el('button', { className: 'menu-item' }, label);
    b.addEventListener('click', action);
    return b;
  }

  function refresh(): void {
    const state = session.store.get();
    timerEl.textContent = state.paused ? '▶' : formatMs(session.activeMs());
    pencilBtn.classList.toggle('active', state.pencilMode);
  }

  refresh();
  return { root, refresh };
}
