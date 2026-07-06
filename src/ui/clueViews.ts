/** Clue presentation: dual clue-list columns (wide layouts) and the
 * current-clue bar with prev/next steppers (all layouts; primary control
 * on phones). Dumb views over the SolveSession. */

import type { SolveSession } from '../solve/session.ts';
import type { Clue, Direction, Slot } from '../core/types.ts';
import { el } from './dom.ts';

function clueFor(session: SolveSession, slot: Slot): Clue | undefined {
  return session.puzzle.clues[slot.dir].find((c) => c.num === slot.num);
}

export interface ClueList {
  root: HTMLElement;
  refresh(): void;
}

export function createClueLists(session: SolveSession): ClueList {
  const root = el('div', { className: 'clue-columns' });
  const itemsBySlot = new Map<string, HTMLElement>();

  for (const dir of ['across', 'down'] as Direction[]) {
    const list = el('ol', { className: 'clue-list' });
    for (const slot of session.slots(dir)) {
      const clue = clueFor(session, slot);
      const item = el('li', { className: 'clue-item', 'data-slot': slot.id },
        el('span', { className: 'clue-num' }, String(slot.num)),
        el('span', { className: 'clue-text' }, clue?.clue ?? ''),
      );
      item.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        session.focusSlot(slot);
      });
      itemsBySlot.set(slot.id, item);
      list.append(item);
    }
    root.append(
      el('section', { className: 'clue-col' },
        el('h3', { className: 'clue-col-title' }, dir === 'across' ? 'Across' : 'Down'),
        list,
      ),
    );
  }

  function refresh(): void {
    const current = session.currentSlot();
    const crossing = session.crossingSlot();
    for (const [slotId, item] of itemsBySlot) {
      const slot = session.slotById(slotId)!;
      const classes = ['clue-item'];
      if (slotId === current.id) classes.push('active');
      else if (crossing && slotId === crossing.id) classes.push('crossing');
      if (session.slotFilled(slot)) classes.push('filled');
      item.className = classes.join(' ');
    }
    // Keep the active clue visible in its column.
    const activeEl = itemsBySlot.get(current.id);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }

  refresh();
  return { root, refresh };
}

export interface ClueBar {
  root: HTMLElement;
  refresh(): void;
}

export function createClueBar(session: SolveSession): ClueBar {
  const numEl = el('span', { className: 'bar-num' });
  const textEl = el('span', { className: 'bar-text' });

  const prev = el('button', { className: 'bar-step', 'aria-label': 'Previous clue' }, '‹');
  const next = el('button', { className: 'bar-step', 'aria-label': 'Next clue' }, '›');
  prev.addEventListener('pointerdown', (e) => { e.preventDefault(); session.nextClue(-1); });
  next.addEventListener('pointerdown', (e) => { e.preventDefault(); session.nextClue(1); });

  const center = el('button', { className: 'bar-center', 'aria-label': 'Toggle direction' }, numEl, textEl);
  center.addEventListener('pointerdown', (e) => { e.preventDefault(); session.toggleDirection(); });

  const root = el('div', { className: 'clue-bar' }, prev, center, next);

  function refresh(): void {
    const slot = session.currentSlot();
    const clue = clueFor(session, slot);
    numEl.textContent = `${slot.num}${slot.dir === 'across' ? 'A' : 'D'}`;
    textEl.textContent = clue?.clue ?? '';
  }

  refresh();
  return { root, refresh };
}
