/** In-progress puzzle persistence (localStorage) and solve-completion
 * bookkeeping: streaks, personal bests, and the stats write. */

import type { SolveSession } from './session.ts';
import { loadJson, removeKey, saveJson } from '../storage/settings.ts';
import { recordSolve } from '../stats/events.ts';
import { formatMs } from '../ui/toolbar.ts';

interface SavedProgress {
  letters: string[];      // per-cell, '' for empty, aligned to row-major cells
  pencils: number[];      // indexes with pencil marks
  activeMs: number;
  counts: { checks: number; reveals: number; hints: number; wrongLetters: number };
}

export function persistProgress(session: SolveSession): void {
  if (session.store.get().completed) return;
  const letters: string[] = [];
  const pencils: number[] = [];
  session.cells.forEach((cell, i) => {
    letters.push(cell.letter);
    if (cell.pencil) pencils.push(i);
  });
  const saved: SavedProgress = {
    letters,
    pencils,
    activeMs: session.activeMs(),
    counts: { ...session.counts },
  };
  saveJson(`progress.${session.puzzle.id}`, saved);
}

export function restoreProgress(session: SolveSession): boolean {
  const saved = loadJson<SavedProgress | null>(`progress.${session.puzzle.id}`, null);
  if (!saved || saved.letters.length !== session.cells.length) return false;
  saved.letters.forEach((letter, i) => {
    session.cells[i]!.letter = letter;
    session.cells[i]!.pencil = false;
  });
  for (const i of saved.pencils) session.cells[i]!.pencil = true;
  Object.assign(session.counts, saved.counts);
  // Resume the clock where it left off instead of restarting from zero (which
  // also kept recorded solve-times from undercounting multi-sitting solves).
  session.seedElapsed(saved.activeMs);
  // Progress state predates this session object; nudge subscribers once.
  session.store.update((s) => ({ ...s, version: s.version + 1 }));
  return true;
}

export function clearProgress(puzzleId: string): void {
  removeKey(`progress.${puzzleId}`);
}

export function hasProgress(puzzleId: string): boolean {
  return loadJson<SavedProgress | null>(`progress.${puzzleId}`, null) !== null;
}

/* --- Streaks & bests ------------------------------------------------------ */

interface StreakState {
  current: number;
  best: number;
  lastDate: string; // last daily date counted
}

export function getStreak(): StreakState {
  return loadJson<StreakState>('streak', { current: 0, best: 0, lastDate: '' });
}

function bumpStreak(dateIso: string): StreakState {
  const streak = getStreak();
  if (streak.lastDate === dateIso) return streak;
  const prev = new Date(dateIso);
  prev.setDate(prev.getDate() - 1);
  const prevIso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
  const next: StreakState = {
    current: streak.lastDate === prevIso ? streak.current + 1 : 1,
    best: 0,
    lastDate: dateIso,
  };
  next.best = Math.max(streak.best, next.current);
  saveJson('streak', next);
  return next;
}

/** Completion hook: stats write + streak/PB milestones. Returns
 * human-readable milestone lines for the celebration modal. */
export async function onSolveComplete(
  session: SolveSession,
  speedExtras?: { speedMode: boolean; parMs: number },
): Promise<string[]> {
  const milestones: string[] = [];
  const puzzle = session.puzzle;
  const ms = session.activeMs();

  // Personal best per (kind, size, weekday-ish difficulty).
  const pbKey = `pb.${puzzle.kind}.${puzzle.size.rows}.${puzzle.difficulty}`;
  const pb = loadJson<number | null>(pbKey, null);
  if (session.store.get().flawless || session.counts.reveals === 0) {
    if (pb === null || ms < pb) {
      saveJson(pbKey, ms);
      if (pb !== null) milestones.push(`New personal best — ${formatMs(ms)} (was ${formatMs(pb)})`);
    }
  }

  if ((puzzle.kind === 'daily' || puzzle.kind === 'mini') && puzzle.date) {
    const streak = bumpStreak(puzzle.date);
    if (streak.current > 1) milestones.push(`🔥 ${streak.current}-day streak`);
    if (streak.current === streak.best && streak.current > 2) milestones.push('Longest streak yet!');
    // Mark the archive calendar.
    const done = loadJson<Record<string, string[]>>('completedDailies', {});
    const forDate = new Set(done[puzzle.date] ?? []);
    forDate.add(puzzle.kind);
    done[puzzle.date] = [...forDate];
    saveJson('completedDailies', done);
  }

  if (session.store.get().flawless) milestones.push('No checks, no reveals, no hints — a clean sheet.');

  try {
    await recordSolve(session, speedExtras ?? {});
  } catch {
    // Stats are best-effort; never block the celebration.
  }
  return milestones;
}
