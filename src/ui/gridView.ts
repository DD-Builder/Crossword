/** Grid renderer: a CSS-grid of cell divs, rebuilt once per puzzle and
 * patched on every session change. Dumb view — all state lives in the
 * SolveSession. */

import type { SolveSession } from '../solve/session.ts';
import { el } from './dom.ts';
import { getSettings } from '../storage/settings.ts';

export interface GridView {
  root: HTMLElement;
  /** Re-read session state and patch cell classes/letters. */
  refresh(): void;
}

export function createGridView(session: SolveSession): GridView {
  const { rows, cols, numbers } = session.info;
  const root = el('div', {
    className: 'xw-grid',
    role: 'grid',
    'aria-label': `${session.puzzle.title} crossword grid`,
  });
  root.style.setProperty('--grid-cols', String(cols));
  root.style.setProperty('--grid-rows', String(rows));

  // Circled cells (cosmetic theme overlay): row-major indices from the puzzle.
  const circled = new Set(session.puzzle.circles ?? []);

  interface CellRef {
    wrap: HTMLElement;
    letter: HTMLElement;
    row: number;
    col: number;
  }
  const refs: CellRef[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (session.isBlock(r, c)) {
        root.append(el('div', { className: 'xw-cell block', role: 'presentation' }));
        continue;
      }
      const num = numbers[r]![c]!;
      const letter = el('span', { className: 'xw-letter' });
      const wrap = el('div', {
        className: 'xw-cell',
        role: 'gridcell',
        tabindex: '-1',
        'data-rc': `${r},${c}`,
      },
        num > 0 ? el('span', { className: 'xw-num' }, String(num)) : null,
        circled.has(r * cols + c) ? el('span', { className: 'xw-circle', 'aria-hidden': 'true' }) : null,
        letter,
      );
      // pointerdown (not click) so iPad taps feel instant.
      wrap.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        session.clickCell(r, c);
      });
      refs.push({ wrap, letter, row: r, col: c });
      root.append(wrap);
    }
  }

  function refresh(): void {
    const { cursor, direction, onFire } = session.store.get();
    const slot = session.currentSlot();
    const inWord = new Set(slot.cells.map((c) => `${c.row},${c.col}`));
    // The streak flame rides the active word — cosmetic, and only when the
    // player hasn't opted out of animations. The ember outline lights every
    // box, but a single lick of flame sits at just one corner of the word (the
    // first cell) so it stays subtle, not a bonfire on every square.
    const flaming = onFire && getSettings().victoryAnimations;
    const tipKey = flaming ? `${slot.cells[0]!.row},${slot.cells[0]!.col}` : '';

    for (const ref of refs) {
      const cell = session.cellAt(ref.row, ref.col);
      const key = `${ref.row},${ref.col}`;
      const isCursor = cursor.row === ref.row && cursor.col === ref.col;

      ref.letter.textContent = cell.letter;

      const classes = ['xw-cell'];
      if (isCursor) classes.push('selected');
      else if (inWord.has(key)) classes.push('in-word');
      if (flaming && inWord.has(key)) classes.push('on-fire');
      if (key === tipKey) classes.push('fire-tip');
      if (cell.pencil) classes.push('pencil');
      if (cell.flag === 'checked-wrong') classes.push('wrong');
      if (cell.flag === 'revealed') classes.push('revealed');
      if (cell.flag === 'confirmed') classes.push('confirmed');
      ref.wrap.className = classes.join(' ');
      ref.wrap.setAttribute('aria-selected', isCursor ? 'true' : 'false');
    }
    root.dataset.direction = direction;
  }

  refresh();
  return { root, refresh };
}
