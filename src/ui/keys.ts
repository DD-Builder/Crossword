/** Physical-keyboard layer: one document-level keydown dispatcher bound to
 * the active solve session. NYT parity:
 *   letters      type + smart advance      Backspace   clear/step back
 *   arrows       move (perpendicular flips first)
 *   Space        toggle direction          Tab / Shift-Tab  next/prev clue
 *   Enter        next clue                 Delete      clear cell
 *   Esc          pause toggle              .           toggle pencil mode
 */

import type { SolveSession } from '../solve/session.ts';
import { getSettings } from '../storage/settings.ts';

export interface KeyboardHandle {
  detach(): void;
  /** Fires on the first hardware keydown (used to hide the soft keyboard). */
  onHardwareKey?: () => void;
}

export function attachKeyboard(
  session: SolveSession,
  hooks: { onPauseToggle?: () => void; onHardwareKey?: () => void } = {},
): KeyboardHandle {
  let sawHardware = false;

  const handler = (e: KeyboardEvent): void => {
    // Never fight real inputs (settings fields, theme box, etc.).
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (!sawHardware) {
      sawHardware = true;
      hooks.onHardwareKey?.();
    }

    const state = session.store.get();
    if (state.completed) return;

    if (state.paused) {
      // Any key resumes (matches the pause overlay's "press any key").
      if (e.key !== 'Meta') {
        e.preventDefault();
        hooks.onPauseToggle?.();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); session.arrow(-1, 0); return;
      case 'ArrowDown': e.preventDefault(); session.arrow(1, 0); return;
      case 'ArrowLeft': e.preventDefault(); session.arrow(0, -1); return;
      case 'ArrowRight': e.preventDefault(); session.arrow(0, 1); return;
      case ' ': e.preventDefault(); session.toggleDirection(); return;
      case 'Tab':
        e.preventDefault();
        session.nextClue(e.shiftKey ? -1 : 1);
        return;
      case 'Enter': e.preventDefault(); session.nextClue(1); return;
      case 'Backspace': e.preventDefault(); session.backspace(); return;
      case 'Delete': e.preventDefault(); session.clearCell(); return;
      case 'Escape': e.preventDefault(); hooks.onPauseToggle?.(); return;
      case '.': e.preventDefault(); session.togglePencilMode(); return;
      default:
        if (/^[a-zA-Z]$/.test(e.key)) {
          e.preventDefault();
          session.typeLetter(e.key, { smartSkip: getSettings().smartSkip });
        }
    }
  };

  document.addEventListener('keydown', handler);
  return {
    detach: () => document.removeEventListener('keydown', handler),
  };
}
