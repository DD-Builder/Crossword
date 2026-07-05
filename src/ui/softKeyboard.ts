/** Custom on-screen keyboard (no <input> anywhere in the app). Three rows,
 * ABC layout, backspace + next-clue keys. Hidden automatically once a
 * hardware keyboard is detected. */

import type { SolveSession } from '../solve/session.ts';
import { getSettings } from '../storage/settings.ts';
import { el } from './dom.ts';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export interface SoftKeyboard {
  root: HTMLElement;
  hide(): void;
}

export function createSoftKeyboard(session: SolveSession): SoftKeyboard {
  const root = el('div', { className: 'soft-kbd', 'aria-hidden': 'true' });

  ROWS.forEach((row, i) => {
    const rowEl = el('div', { className: 'soft-kbd-row' });
    if (i === 2) {
      rowEl.append(makeKey('⇥', 'wide', () => session.nextClue(1), 'Next clue'));
    }
    for (const ch of row) {
      rowEl.append(makeKey(ch, '', () => session.typeLetter(ch, { smartSkip: getSettings().smartSkip }), ch));
    }
    if (i === 2) {
      rowEl.append(makeKey('⌫', 'wide', () => session.backspace(), 'Backspace'));
    }
    root.append(rowEl);
  });

  function makeKey(label: string, extra: string, action: () => void, aria: string): HTMLElement {
    const key = el('button', {
      className: `soft-key ${extra}`.trim(),
      'aria-label': aria,
    }, label);
    key.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      action();
    });
    return key;
  }

  return {
    root,
    hide: () => root.classList.add('hidden'),
  };
}
