/** Share a finished solve: emoji mini-map + stats text via the Web Share
 * API, clipboard fallback. */

import type { SolveSession } from '../solve/session.ts';
import { formatMs } from './toolbar.ts';
import { toast } from './dom.ts';

/** Wordle-style map: ⬛ block, 🟨 revealed, 🟦 hinted word, 🟩 clean. */
export function emojiGrid(session: SolveSession): string {
  const { rows, cols } = session.info;
  // Cells belonging to slots where a hint tier ≥3 was used read as "hinted".
  const hintedCells = new Set<string>();
  for (const [slotId, timing] of session.clueTimings) {
    if (timing.hintTiers.some((t) => t >= 3)) {
      const slot = session.slotById(slotId);
      slot?.cells.forEach((c) => hintedCells.add(`${c.row},${c.col}`));
    }
  }

  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      if (session.isBlock(r, c)) line += '⬛';
      else if (session.cellAt(r, c).flag === 'revealed') line += '🟨';
      else if (hintedCells.has(`${r},${c}`)) line += '🟦';
      else line += '🟩';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export function shareText(session: SolveSession): string {
  const p = session.puzzle;
  const flawless = session.store.get().flawless;
  const time = formatMs(session.activeMs());
  const header = p.date
    ? `Riddle Crossword · ${p.title} · ${p.date}`
    : `Riddle Crossword · ${p.title}`;
  return `${header}\n${time}${flawless ? ' · flawless ✨' : ''}\n\n${emojiGrid(session)}`;
}

export async function shareSolve(session: SolveSession): Promise<void> {
  const text = shareText(session);
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch {
    // fall through to clipboard (user may simply have dismissed the sheet)
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Result copied — go brag');
  } catch {
    toast('Could not share on this device');
  }
}
