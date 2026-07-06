/** The hint ladder — six escalating tiers hosted by "Professor Down", the
 * app's gently smug crossword coach. Pure logic; UI lives in hintUi.ts. */

import type { SolveSession } from './session.ts';
import type { Category, Slot } from '../core/types.ts';
import { CATEGORY_LABELS } from '../core/types.ts';
import { rngFrom } from '../core/rng.ts';

export interface HintTier {
  tier: number;
  label: string;
  /** Short cost hint shown on the button ("gentle" → "spoiler"). */
  heat: 'gentle' | 'warm' | 'hot' | 'spoiler';
  run(session: SolveSession): HintResult;
}

export interface HintResult {
  /** Professor Down's line, shown in the hint panel. */
  message: string;
  /** True when the hint changed the grid (reveal-style hints). */
  changedGrid: boolean;
}

function currentAnswer(session: SolveSession): { slot: Slot; answer: string; category: Category } {
  const slot = session.currentSlot();
  const answer = slot.cells.map((c) => session.solutionAt(c.row, c.col)).join('');
  const clue = session.puzzle.clues[slot.dir].find((c) => c.num === slot.num);
  return { slot, answer, category: clue?.category ?? 'wordplay' };
}

/** Count letters typed into the slot that are correct AND correctly placed. */
function correctCount(session: SolveSession, slot: Slot): { right: number; typed: number } {
  let right = 0;
  let typed = 0;
  for (const c of slot.cells) {
    const cell = session.cellAt(c.row, c.col);
    if (cell.letter === '') continue;
    typed++;
    if (cell.letter === session.solutionAt(c.row, c.col)) right++;
  }
  return { right, typed };
}

const PROFESSOR_OPENERS = [
  'Ahem.',
  'Very well.',
  'Since you asked nicely —',
  'A nudge, then.',
  'Professor Down obliges:',
  'Between us:',
];

function opener(session: SolveSession, tier: number): string {
  const rng = rngFrom(`prof|${session.puzzle.id}|${session.currentSlot().id}|${tier}|${session.counts.hints}`);
  return PROFESSOR_OPENERS[rng.int(PROFESSOR_OPENERS.length)]!;
}

export const HINT_TIERS: HintTier[] = [
  {
    tier: 1,
    label: 'Whisper the category',
    heat: 'gentle',
    run(session) {
      const { category } = currentAnswer(session);
      return {
        message: `${opener(session, 1)} This one lives in **${CATEGORY_LABELS[category]}**. That's all you're getting… for now.`,
        changedGrid: false,
      };
    },
  },
  {
    tier: 2,
    label: 'Warmer / colder',
    heat: 'gentle',
    run(session) {
      const { slot, answer } = currentAnswer(session);
      const { right, typed } = correctCount(session, slot);
      let verdict: string;
      if (typed === 0) verdict = `An empty slate! Bold strategy. It's ${answer.length} letters, if that helps.`;
      else if (right === typed) verdict = `All ${right} letter${right === 1 ? '' : 's'} you've placed are correct. Toasty. Keep going.`;
      else if (right === 0) verdict = `Of your ${typed} letter${typed === 1 ? '' : 's'}, precisely zero are right. Refreshingly decisive. Try a different tack.`;
      else verdict = `${right} of your ${typed} letters are correct. Warmer than you think — but something's an impostor.`;
      return { message: `${opener(session, 2)} ${verdict}`, changedGrid: false };
    },
  },
  {
    tier: 3,
    label: 'First letter',
    heat: 'warm',
    run(session) {
      const { slot, answer } = currentAnswer(session);
      const first = slot.cells[0]!;
      const cell = session.cellAt(first.row, first.col);
      const already = cell.letter === answer[0];
      return {
        message: already
          ? `${opener(session, 3)} It starts with **${answer[0]}** — which you already had. This hint is free of charge to your dignity.`
          : `${opener(session, 3)} It begins with **${answer[0]}**. Say no more.`,
        changedGrid: false,
      };
    },
  },
  {
    tier: 4,
    label: 'Vowel peek',
    heat: 'hot',
    run(session) {
      const { answer } = currentAnswer(session);
      const shape = [...answer]
        .map((ch) => ('AEIOU'.includes(ch) ? ch : '·'))
        .join(' ');
      return {
        message: `${opener(session, 4)} The vowels sit like so: **${shape}**. Consonants are your problem.`,
        changedGrid: false,
      };
    },
  },
  {
    tier: 5,
    label: 'Anagram scramble',
    heat: 'hot',
    run(session) {
      const { slot, answer } = currentAnswer(session);
      const rng = rngFrom(`scramble|${session.puzzle.id}|${slot.id}`);
      let letters = [...answer];
      // Guarantee a real scramble for words with >1 distinct letter.
      for (let tries = 0; tries < 10; tries++) {
        letters = rng.shuffle([...answer]);
        if (letters.join('') !== answer) break;
      }
      return {
        message: `${opener(session, 5)} Every letter, wrong order: **${letters.join(' ')}**. Assembly required.`,
        changedGrid: false,
      };
    },
  },
  {
    tier: 6,
    label: 'Just tell me',
    heat: 'spoiler',
    run(session) {
      session.revealWord();
      return {
        message: `${opener(session, 6)} Done. We shall never speak of this again.`,
        changedGrid: true,
      };
    },
  },
];
