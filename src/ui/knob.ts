/** A rotary "amplifier knob" control — click the right half to advance, the
 * left half to go back, or focus it and use the arrow keys. Discrete
 * positions only (no free rotation): each position maps to an angle across a
 * 270° sweep, same idea as a stepped rack-gear knob. Zero dependencies, one
 * small reusable primitive used by the in-puzzle tune rack (and anywhere else
 * a themed skin wants a physical-feeling control instead of a chip row). */

import { el } from './dom.ts';

export interface KnobOptions {
  /** Caption above the knob, e.g. "DIFFICULTY". */
  label: string;
  /** Display text per position, e.g. ['Kids', 'Mon', …, 'Sun']. */
  positions: string[];
  index: number;
  onChange: (index: number) => void;
  disabled?: boolean;
}

export interface KnobHandle {
  root: HTMLElement;
  setIndex(i: number): void;
  setDisabled(d: boolean): void;
}

const SWEEP_DEG = 270;
const START_DEG = -135;

function angleFor(index: number, count: number): number {
  if (count <= 1) return 0;
  return START_DEG + (index / (count - 1)) * SWEEP_DEG;
}

export function createKnob(opts: KnobOptions): KnobHandle {
  let index = opts.index;
  let disabled = opts.disabled ?? false;
  const count = opts.positions.length;

  const dial = el('div', { className: 'knob-dial', 'aria-hidden': 'true' },
    el('div', { className: 'knob-pointer' }),
  );
  // A tick per position around the rim — purely decorative, but it's what
  // reads as "amplifier" rather than "generic dropdown."
  const ticks = el('div', { className: 'knob-ticks', 'aria-hidden': 'true' },
    ...opts.positions.map((_, i) => {
      const deg = angleFor(i, count);
      return el('span', { className: 'knob-tick', style: `transform: rotate(${deg}deg) translateY(calc(-1 * var(--knob-r)))` });
    }),
  );
  const body = el('div', { className: 'knob-body' }, ticks, dial);
  const valueLabel = el('div', { className: 'knob-value' }, opts.positions[index] ?? '');
  const caption = el('div', { className: 'knob-caption' }, opts.label);

  const root = el('div', { className: 'knob', tabindex: 0, role: 'slider',
    'aria-label': opts.label,
    'aria-valuemin': 0, 'aria-valuemax': count - 1, 'aria-valuenow': index,
    'aria-valuetext': opts.positions[index] ?? '',
  }, caption, body, valueLabel);

  const paint = (): void => {
    dial.style.transform = `rotate(${angleFor(index, count)}deg)`;
    valueLabel.textContent = opts.positions[index] ?? '';
    root.setAttribute('aria-valuenow', String(index));
    root.setAttribute('aria-valuetext', opts.positions[index] ?? '');
    root.classList.toggle('disabled', disabled);
    root.tabIndex = disabled ? -1 : 0;
  };
  paint();

  const set = (next: number, fire: boolean): void => {
    const clamped = Math.min(count - 1, Math.max(0, next));
    if (clamped === index) return;
    index = clamped;
    paint();
    if (fire) opts.onChange(index);
  };

  body.addEventListener('click', (e) => {
    if (disabled) return;
    const rect = body.getBoundingClientRect();
    const clickX = (e as MouseEvent).clientX - (rect.left + rect.width / 2);
    set(index + (clickX >= 0 ? 1 : -1), true);
  });

  root.addEventListener('keydown', (e) => {
    if (disabled) return;
    const key = (e as KeyboardEvent).key;
    if (key === 'ArrowRight' || key === 'ArrowUp') { e.preventDefault(); set(index + 1, true); }
    else if (key === 'ArrowLeft' || key === 'ArrowDown') { e.preventDefault(); set(index - 1, true); }
    else if (key === 'Home') { e.preventDefault(); set(0, true); }
    else if (key === 'End') { e.preventDefault(); set(count - 1, true); }
  });

  return {
    root,
    setIndex(i: number) { set(i, false); },
    setDisabled(d: boolean) { disabled = d; paint(); },
  };
}
