import { describe, expect, it } from 'vitest';
import { buildIndex, countCandidates, candidates } from './index.ts';
import { fill } from './filler.ts';
import { rngFrom } from '../rng.ts';
import { templateToGrid, deriveSlots, slotAnswer, isCompleteGrid } from '../grid.ts';
import type { BankEntry } from '../types.ts';

/** Compact synthetic bank for engine tests (the real bank lives in src/data
 * and is exercised by the fill-smoke script). FIXTURE_WORDS interlock into
 * a known-valid corner-block 5x5; DISTRACTORS never complete a grid. */
const mk = (answer: string, score = 60): BankEntry => ({
  answer,
  score,
  categories: ['wordplay'],
  tags: [],
  clues: [
    { text: `Test clue (${answer.length})`, difficulty: 1, stars: 1 },
    { text: `Harder test clue (${answer.length})`, difficulty: 4, stars: 3 },
  ],
});

const FIXTURE_WORDS = ['SPA', 'SHONE', 'TONER', 'ARENA', 'EST', 'STA', 'SHORE', 'PONES', 'ANENT', 'ERA'];
const DISTRACTORS = ['TEA', 'ART', 'RAT', 'ORE', 'ONE', 'TEN', 'NET', 'SET', 'OAT', 'ANT',
  'STARE', 'AROSE', 'RAISE', 'LEAST', 'STEAL', 'TALES', 'SLATE', 'STONE',
  'NOTES', 'ONSET', 'SNORE', 'ROAST', 'RATES', 'TEARS', 'STORE', 'PIANO'];

const CORNERS: [number, number][] = [[0, 0], [0, 4], [4, 0], [4, 4]];

describe('bank index', () => {
  const idx = buildIndex([...FIXTURE_WORDS, ...DISTRACTORS].map((w) => mk(w)));

  it('buckets by length', () => {
    const all = [...FIXTURE_WORDS, ...DISTRACTORS];
    expect(idx.byLen.get(3)!.entries).toHaveLength(all.filter((w) => w.length === 3).length);
    expect(idx.byLen.get(5)!.entries).toHaveLength(all.filter((w) => w.length === 5).length);
  });

  it('counts pattern candidates correctly', () => {
    const l5 = idx.byLen.get(5)!;
    const five = [...FIXTURE_WORDS, ...DISTRACTORS].filter((w) => w.length === 5);
    expect(countCandidates(l5, 'S????')).toBe(five.filter((w) => w.startsWith('S')).length);
    expect(countCandidates(l5, '?????')).toBe(five.length);
    expect(countCandidates(l5, 'ZZ???')).toBe(0);
  });

  it('iterates exactly the matching candidates', () => {
    const l5 = idx.byLen.get(5)!;
    const five = [...FIXTURE_WORDS, ...DISTRACTORS].filter((w) => w.length === 5);
    const got = [...candidates(l5, '??O??')].map((e) => e.answer).sort();
    expect(got).toEqual(five.filter((w) => w[2] === 'O').sort());
  });
});

describe('fill', () => {
  const bank = buildIndex([...FIXTURE_WORDS, ...DISTRACTORS].map((w) => mk(w)));

  it('reconstructs the known-solvable corner 5x5', () => {
    const result = fill(templateToGrid(5, CORNERS), bank, rngFrom('probe'));
    expect(result.ok).toBe(true);
    expect(isCompleteGrid(result.grid!)).toBe(true);

    const info = deriveSlots(result.grid!, 3);
    const answers = info.slots.map((s) => slotAnswer(result.grid!, s));
    expect(new Set(answers).size).toBe(answers.length);
    for (const a of answers) expect(bank.byAnswer.has(a)).toBe(true);
    expect(result.placed!.size).toBe(answers.length);
  });

  it('is deterministic for the same seed', () => {
    const a = fill(templateToGrid(5, CORNERS), bank, rngFrom('same-seed'));
    const b = fill(templateToGrid(5, CORNERS), bank, rngFrom('same-seed'));
    expect(a.ok).toBe(b.ok);
    expect(a.grid).toEqual(b.grid);
    expect(a.steps).toBe(b.steps);
  });

  it('honors seed entries', () => {
    const result = fill(templateToGrid(5, CORNERS), bank, rngFrom('seeded'), {
      seedEntries: ['ARENA'],
    });
    expect(result.ok).toBe(true);
    expect(result.grid!.join('/')).toContain('ARENA');
  });

  it('fails cleanly when a seed cannot fit', () => {
    const result = fill(templateToGrid(5, CORNERS), bank, rngFrom('x'), {
      seedEntries: ['IMPOSSIBLE'],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('seed-unplaceable');
  });

  it('respects the score floor', () => {
    const cheapFives = [...FIXTURE_WORDS, ...DISTRACTORS].map((w) =>
      mk(w, w.length === 5 ? 20 : 90),
    );
    const result = fill(templateToGrid(5, CORNERS), buildIndex(cheapFives), rngFrom('floor'), {
      scoreFloor: 50,
    });
    expect(result.ok).toBe(false); // every 5-letter word excluded by the floor
  });

  it('reports exhausted search honestly', () => {
    // Distractors alone cannot complete this template.
    const noSolution = buildIndex(DISTRACTORS.map((w) => mk(w)));
    const result = fill(templateToGrid(5, CORNERS), noSolution, rngFrom('none'));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-candidates');
  });
});
