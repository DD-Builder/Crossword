/** Hint ladder UI: Professor Down's panel. Each tier used on the current
 * clue is logged to the session for stats. */

import type { SolveSession } from './session.ts';
import { HINT_TIERS } from './hints.ts';
import { el, openModal } from '../ui/dom.ts';

/** Render **bold** spans in the professor's lines without innerHTML. */
function richText(message: string): (Node | string)[] {
  const parts: (Node | string)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (let m = regex.exec(message); m; m = regex.exec(message)) {
    if (m.index > last) parts.push(message.slice(last, m.index));
    parts.push(el('strong', {}, m[1]!));
    last = m.index + m[0].length;
  }
  if (last < message.length) parts.push(message.slice(last));
  return parts;
}

export function openHintLadder(session: SolveSession): void {
  const slot = session.currentSlot();
  const clue = session.puzzle.clues[slot.dir].find((c) => c.num === slot.num);

  openModal((body, close) => {
    const speech = el('div', { className: 'prof-speech' },
      el('p', { className: 'muted' }, 'Pick your poison. The higher you climb, the less glory remains.'),
    );

    const buttons = HINT_TIERS.map((tier) => {
      const btn = el('button', { className: `menu-item hint-tier heat-${tier.heat}` },
        el('span', { className: 'hint-label' }, tier.label),
        el('span', { className: 'hint-heat' }, tier.heat),
      );
      btn.addEventListener('click', () => {
        session.noteHint(tier.tier);
        const result = tier.run(session);
        speech.replaceChildren(el('p', { className: 'prof-line' }, ...richText(result.message)));
        if (result.changedGrid) window.setTimeout(close, 900);
      });
      return btn;
    });

    body.append(
      el('div', { className: 'prof-head' },
        el('span', { className: 'prof-avatar', 'aria-hidden': 'true' }, '🎓'),
        el('div', {},
          el('h3', {}, 'Professor Down'),
          el('p', { className: 'muted prof-clue' },
            `${slot.num}${slot.dir === 'across' ? 'A' : 'D'}: “${clue?.clue ?? ''}”`),
        ),
      ),
      speech,
      el('div', { className: 'menu-list' }, ...buttons),
    );
  });
}
