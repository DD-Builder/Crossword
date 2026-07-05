/** Shared test fixture: a small valid 5x5 mini authored for this repo.
 *
 *   # S P A #
 *   S H O N E
 *   T O N E R
 *   A R E N A
 *   # E S T #
 *
 * Across: SPA, SHONE, TONER, ARENA, EST
 * Down:   STA, SHORE, PONES, ANENT, ERA
 */
import type { Puzzle } from './types';

export const MINI_FIXTURE: Puzzle = {
  id: 'test-mini-1',
  kind: 'mini',
  title: 'Test Mini',
  author: 'Fixtures',
  difficulty: 1,
  size: { rows: 5, cols: 5 },
  grid: ['#SPA#', 'SHONE', 'TONER', 'ARENA', '#EST#'],
  clues: {
    across: [
      { num: 1, answer: 'SPA', clue: 'Place to unwind in hot water', stars: 2, category: 'sports-leisure' },
      { num: 4, answer: 'SHONE', clue: 'Glowed', stars: 1, category: 'wordplay' },
      { num: 6, answer: 'TONER', clue: 'Printer cartridge filler', stars: 1, category: 'science-nature' },
      { num: 7, answer: 'ARENA', clue: 'Where gladiators clashed', stars: 1, category: 'history' },
      { num: 8, answer: 'EST', clue: 'New York clock setting: Abbr.', stars: 1, category: 'geography' },
    ],
    down: [
      { num: 1, answer: 'SHORE', clue: 'Where the tide checks in', stars: 2, category: 'geography' },
      { num: 2, answer: 'PONES', clue: 'Corn breads, in the South', stars: 3, category: 'entertainment' },
      { num: 3, answer: 'ANENT', clue: 'Concerning, quaintly', stars: 4, category: 'arts-literature' },
      { num: 4, answer: 'STA', clue: 'Rail stop: Abbr.', stars: 2, category: 'wordplay' },
      { num: 5, answer: 'ERA', clue: 'Notable stretch of time', stars: 1, category: 'history' },
    ],
  },
};
