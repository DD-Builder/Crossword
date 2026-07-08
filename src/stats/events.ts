/** Solve-completion stats write: one solve row + one row per clue, then a
 * profile refresh. All reads for dashboards live in metrics.ts. */

import type { SolveSession } from '../solve/session.ts';
import type { Category } from '../core/types.ts';
import { put, putMany } from './db.ts';
import { refreshProfile } from './adaptive.ts';

export interface SolveRow {
  puzzleId: string;
  kind: string;
  date: string;          // solve date (ISO), not necessarily the puzzle date
  puzzleDate?: string;
  title: string;
  size: number;
  difficulty: number;
  activeMs: number;
  completedAt: number;   // epoch ms
  hourOfDay: number;
  counts: { checks: number; reveals: number; hints: number; wrongLetters: number };
  flawless: boolean;
  speedMode?: boolean;
  parMs?: number;
  fillOrder: { index: number; t: number }[];
  /** Average stars across the puzzle's clues — the puzzle's craft rating. */
  avgStars: number;
}

export interface ClueRow {
  puzzleId: string;
  date: string;
  slotId: string;
  answer: string;
  clue: string;
  category: Category;
  stars: number;
  /** Pure solve-difficulty tier 1–5 of the clue shown (item rating for Elo).
   * Optional: older rows and placeholder/LLM clues may lack it. */
  difficulty?: number;
  lengthChars: number;
  msToSolve: number | null;   // firstFocus → solved, null if never solved unaided
  wrongLetters: number;
  hintTiers: number[];
  revealed: boolean;
}

export async function recordSolve(
  session: SolveSession,
  extras: { speedMode?: boolean; parMs?: number } = {},
): Promise<void> {
  const puzzle = session.puzzle;
  const now = new Date();
  const dateIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const allClues = [...puzzle.clues.across, ...puzzle.clues.down];
  const avgStars = allClues.length > 0
    ? allClues.reduce((a, c) => a + c.stars, 0) / allClues.length
    : 3;

  const solve: SolveRow = {
    puzzleId: puzzle.id,
    kind: puzzle.kind,
    date: dateIso,
    ...(puzzle.date ? { puzzleDate: puzzle.date } : {}),
    title: puzzle.title,
    size: puzzle.size.rows,
    difficulty: puzzle.difficulty,
    activeMs: session.activeMs(),
    completedAt: Date.now(),
    hourOfDay: now.getHours(),
    counts: { ...session.counts },
    flawless: session.store.get().flawless,
    ...(extras.speedMode !== undefined ? { speedMode: extras.speedMode } : {}),
    ...(extras.parMs !== undefined ? { parMs: extras.parMs } : {}),
    fillOrder: session.fillOrder.slice(0, 4000),
    avgStars,
  };

  const clueRows: ClueRow[] = [];
  for (const dir of ['across', 'down'] as const) {
    for (const clue of puzzle.clues[dir]) {
      const slotId = `${clue.num}-${dir}`;
      const timing = session.clueTimings.get(slotId);
      if (!timing) continue;
      clueRows.push({
        puzzleId: puzzle.id,
        date: dateIso,
        slotId,
        answer: clue.answer,
        clue: clue.clue,
        category: clue.category,
        stars: clue.stars,
        ...(clue.difficulty ? { difficulty: clue.difficulty } : {}),
        lengthChars: clue.answer.length,
        msToSolve:
          timing.solvedMs !== null && timing.firstFocusMs !== null && !timing.revealed
            ? Math.max(0, timing.solvedMs - timing.firstFocusMs)
            : null,
        wrongLetters: timing.wrongLetters,
        hintTiers: timing.hintTiers,
        revealed: timing.revealed,
      });
    }
  }

  await put('solves', solve);
  await putMany('clues', clueRows);
  await refreshProfile();
}
