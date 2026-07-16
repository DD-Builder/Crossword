/** Small shared rendering primitives for the Stats and Player Insights views —
 * split out so neither view has to duplicate the other's tile/bar markup. */

import { el } from './dom.ts';

export function tile(num: string, label: string): HTMLElement {
  return el('div', { className: 'stat-tile card' },
    el('span', { className: 'num' }, num),
    el('span', { className: 'lbl' }, label),
  );
}

export function bar(label: string, value: number, max: number, display: string): HTMLElement {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return el('div', { className: 'bar-row' },
    el('span', {}, label),
    el('span', { className: 'bar-track' },
      el('span', { className: 'bar-fill', style: `width: ${pct}%` }),
    ),
    el('span', { className: 'bar-val' }, display),
  );
}
