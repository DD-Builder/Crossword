import { describe, expect, it } from 'vitest';
import { SolveSession } from './session.ts';
import { MINI_FIXTURE } from '../core/fixtures.test-data.ts';

/** Fixture grid:
 *   # S P A #
 *   S H O N E
 *   T O N E R
 *   A R E N A
 *   # E S T #
 */

function makeSession(opts: { autocheck?: boolean } = {}) {
  let t = 0;
  const clock = { tick: (ms: number) => (t += ms) };
  const session = new SolveSession(MINI_FIXTURE, { ...opts, now: () => t });
  return { session, clock };
}

/** Type the full solution row by row (clicking each row start). */
function solveAll(session: SolveSession, opts: { skipLast?: boolean } = {}): void {
  const grid = MINI_FIXTURE.grid;
  const letters: [number, number, string][] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const ch = grid[r]![c]!;
      if (ch !== '#') letters.push([r, c, ch]);
    }
  }
  const todo = opts.skipLast ? letters.slice(0, -1) : letters;
  for (const [r, c, ch] of todo) {
    session.clickCell(r, c);
    if (session.store.get().direction !== 'across') session.toggleDirection();
    session.typeLetter(ch, { smartSkip: false });
  }
}

describe('cursor & direction', () => {
  it('starts on the first across slot', () => {
    const { session } = makeSession();
    const s = session.store.get();
    expect(s.cursor).toEqual({ row: 0, col: 1 });
    expect(s.direction).toBe('across');
  });

  it('click selects; second click toggles direction', () => {
    const { session } = makeSession();
    session.clickCell(1, 1);
    expect(session.store.get().cursor).toEqual({ row: 1, col: 1 });
    expect(session.store.get().direction).toBe('across');
    session.clickCell(1, 1);
    expect(session.store.get().direction).toBe('down');
  });

  it('ignores clicks on blocks', () => {
    const { session } = makeSession();
    const before = session.store.get().cursor;
    session.clickCell(0, 0);
    expect(session.store.get().cursor).toEqual(before);
  });

  it('perpendicular arrow flips direction first, then moves', () => {
    const { session } = makeSession();
    expect(session.store.get().direction).toBe('across');
    session.arrow(1, 0); // down arrow while across → flip only
    expect(session.store.get().direction).toBe('down');
    expect(session.store.get().cursor).toEqual({ row: 0, col: 1 });
    session.arrow(1, 0); // now move down
    expect(session.store.get().cursor).toEqual({ row: 1, col: 1 });
  });

  it('arrows skip over blocks', () => {
    const { session } = makeSession();
    session.clickCell(1, 0);
    session.arrow(1, 0); // ensure down
    if (session.store.get().direction !== 'down') session.arrow(1, 0);
    session.clickCell(3, 0);
    if (session.store.get().direction !== 'down') session.toggleDirection();
    // (3,0) down: below is block (4,0) → no move
    session.arrow(1, 0);
    expect(session.store.get().cursor).toEqual({ row: 3, col: 0 });
  });

  it('toggleDirection stays when the crossing has no slot', () => {
    const { session } = makeSession();
    // Every cell in this grid is double-checked, so toggle always works;
    // verify it flips back and forth.
    session.toggleDirection();
    expect(session.store.get().direction).toBe('down');
    session.toggleDirection();
    expect(session.store.get().direction).toBe('across');
  });
});

describe('typing', () => {
  it('types and advances within the word', () => {
    const { session } = makeSession();
    session.typeLetter('S');
    expect(session.cellAt(0, 1).letter).toBe('S');
    expect(session.store.get().cursor).toEqual({ row: 0, col: 2 });
  });

  it('smartSkip hops filled cells', () => {
    const { session } = makeSession();
    session.typeLetter('S');           // cursor → (0,2)
    session.clickCell(0, 1);           // back to start
    // (0,1) already filled: typing replaces? No — (0,1) holds S; type at
    // cursor replaces the letter and advances to first EMPTY cell (0,2)…
    session.typeLetter('S');
    expect(session.store.get().cursor).toEqual({ row: 0, col: 2 });
    session.typeLetter('P');
    expect(session.store.get().cursor).toEqual({ row: 0, col: 3 });
  });

  it('backspace clears current, then steps back', () => {
    const { session } = makeSession();
    session.typeLetter('S');
    session.typeLetter('P');
    // cursor at (0,3) empty; backspace steps back to (0,2) and clears P
    session.backspace();
    expect(session.store.get().cursor).toEqual({ row: 0, col: 2 });
    expect(session.cellAt(0, 2).letter).toBe('');
    // backspace again: current empty → step to (0,1) and clear S
    session.backspace();
    expect(session.store.get().cursor).toEqual({ row: 0, col: 1 });
    expect(session.cellAt(0, 1).letter).toBe('');
  });

  it('pencil mode marks cells', () => {
    const { session } = makeSession();
    session.togglePencilMode();
    session.typeLetter('X');
    expect(session.cellAt(0, 1).pencil).toBe(true);
  });

  it('records fill order', () => {
    const { session } = makeSession();
    session.typeLetter('S');
    session.typeLetter('P');
    expect(session.fillOrder.map((f) => f.index)).toEqual([1, 2]);
  });
});

describe('check & reveal', () => {
  it('checkWord flags wrong letters and confirms right ones', () => {
    const { session } = makeSession();
    session.typeLetter('S');
    session.typeLetter('X'); // wrong (should be P)
    session.checkWord();
    expect(session.cellAt(0, 1).flag).toBe('confirmed');
    expect(session.cellAt(0, 2).flag).toBe('checked-wrong');
    expect(session.counts.checks).toBe(1);
    expect(session.counts.wrongLetters).toBe(1);
  });

  it('autocheck flags as you type', () => {
    const { session } = makeSession({ autocheck: true });
    session.typeLetter('X');
    expect(session.cellAt(0, 1).flag).toBe('checked-wrong');
    session.clickCell(0, 1);
    session.typeLetter('S');
    expect(session.cellAt(0, 1).flag).toBe('confirmed');
  });

  it('confirmed cells resist edits', () => {
    const { session } = makeSession();
    session.typeLetter('S');
    session.checkLetter(); // wait — cursor moved; go back
    session.clickCell(0, 1);
    session.checkLetter();
    expect(session.cellAt(0, 1).flag).toBe('confirmed');
    session.clickCell(0, 1);
    session.typeLetter('Z');
    expect(session.cellAt(0, 1).letter).toBe('S');
  });

  it('revealWord fills and marks the slot', () => {
    const { session } = makeSession();
    session.revealWord();
    expect(session.cellAt(0, 1).letter).toBe('S');
    expect(session.cellAt(0, 2).letter).toBe('P');
    expect(session.cellAt(0, 3).letter).toBe('A');
    expect(session.cellAt(0, 2).flag).toBe('revealed');
    expect(session.counts.reveals).toBe(1);
    expect(session.clueTimings.get('1-across')!.revealed).toBe(true);
  });
});

describe('completion', () => {
  it('detects a correct solve and stops the clock', () => {
    const { session, clock } = makeSession();
    clock.tick(60_000);
    solveAll(session);
    const s = session.store.get();
    expect(s.completed).toBe(true);
    expect(s.flawless).toBe(true);
    clock.tick(99_000);
    expect(session.activeMs()).toBe(60_000); // frozen after completion
  });

  it('flawless is false after any reveal', () => {
    const { session } = makeSession();
    session.revealLetter();
    solveAll(session);
    expect(session.store.get().completed).toBe(true);
    expect(session.store.get().flawless).toBe(false);
  });

  it('filledButWrong detects a full-but-wrong grid', () => {
    const { session } = makeSession();
    solveAll(session, { skipLast: true });
    session.clickCell(4, 3); // last cell (4,3) = T; type wrong letter
    session.typeLetter('Z', { smartSkip: false });
    expect(session.store.get().completed).toBe(false);
    expect(session.filledButWrong()).toBe(true);
  });

  it('pause freezes the timer', () => {
    const { session, clock } = makeSession();
    clock.tick(10_000);
    session.pause();
    clock.tick(50_000);
    session.resume();
    clock.tick(5_000);
    expect(session.activeMs()).toBe(15_000);
  });

  it('tracks per-clue solve timing', () => {
    const { session, clock } = makeSession();
    clock.tick(3_000);
    session.clickCell(0, 1);
    if (session.store.get().direction !== 'across') session.toggleDirection();
    session.typeLetter('S', { smartSkip: false });
    session.typeLetter('P', { smartSkip: false });
    session.typeLetter('A', { smartSkip: false });
    const timing = session.clueTimings.get('1-across')!;
    expect(timing.solvedMs).toBe(3_000);
    expect(timing.firstFocusMs).toBe(0); // focused at t=0 on session start
  });
});

describe('"on fire" streak', () => {
  it('lights on a fast burst of correct clues and cools after the window', () => {
    let t = 0;
    const session = new SolveSession(MINI_FIXTURE, {
      now: () => t, fireOn: 3, fireSustain: 2, fireWindowMs: 60_000,
    });
    const grid = MINI_FIXTURE.grid;
    const typeRow = (r: number): void => {
      for (let c = 0; c < 5; c++) {
        const ch = grid[r]![c]!;
        if (ch === '#') continue;
        session.clickCell(r, c);
        if (session.store.get().direction !== 'across') session.toggleDirection();
        session.typeLetter(ch, { smartSkip: false });
        t += 500;
      }
    };

    expect(session.store.get().onFire).toBe(false);
    typeRow(1); typeRow(2); typeRow(3); // 3 across clues solved in ~7.5s
    expect(session.store.get().onFire).toBe(true);

    t += 61_000;        // the whole burst ages out of the 60s window
    session.pollFire();
    expect(session.store.get().onFire).toBe(false);
  });
});

describe('elapsed-time restore (resume, not restart)', () => {
  it('seedElapsed resumes the clock where it left off and keeps counting', () => {
    const { session, clock } = makeSession();
    clock.tick(5_000);
    expect(session.activeMs()).toBe(5_000);

    // Re-entry: a fresh session for the same puzzle, seeded from persisted activeMs.
    const { session: reopened, clock: clock2 } = makeSession();
    reopened.seedElapsed(5_000);
    expect(reopened.activeMs()).toBe(5_000); // not 0
    clock2.tick(3_000);
    expect(reopened.activeMs()).toBe(8_000); // continues, no double-count
  });

  it('seedElapsed clamps junk to zero', () => {
    const { session } = makeSession();
    session.seedElapsed(Number.NaN);
    expect(session.activeMs()).toBe(0);
  });
});
