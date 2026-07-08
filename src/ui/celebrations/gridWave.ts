/** The "cleverly incorporated" beat: on win, the solved grid itself ripples —
 * a diagonal flash sweeping cell by cell before the canvas scene takes over.
 * Pure CSS after class application; reduced-motion kills it automatically. */

export function playGridWave(gridEl: HTMLElement | null): void {
  if (!gridEl) return;
  const cells = gridEl.querySelectorAll<HTMLElement>('.xw-cell');
  const cols = Number(gridEl.style.getPropertyValue('--grid-cols')) ||
    getComputedStyle(gridEl).gridTemplateColumns.split(' ').length || 1;
  cells.forEach((cell, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    cell.style.setProperty('--wd', `${(row + col) * 36}ms`);
  });
  gridEl.classList.add('win-wave');
  // One-shot: drop the class after the longest delay + animation has played.
  const total = (2 * Math.ceil(cells.length / cols)) * 36 + 900;
  window.setTimeout(() => gridEl.classList.remove('win-wave'), total);
}

/** Retune morph: the fresh grid cascades in cell by cell along the diagonal —
 * the player watches the puzzle rebuild when they change a knob. */
export function playGridMorphIn(gridEl: HTMLElement | null): void {
  if (!gridEl) return;
  const cells = gridEl.querySelectorAll<HTMLElement>('.xw-cell');
  const cols = Number(gridEl.style.getPropertyValue('--grid-cols')) ||
    getComputedStyle(gridEl).gridTemplateColumns.split(' ').length || 1;
  cells.forEach((cell, i) => {
    cell.style.setProperty('--wd', `${(Math.floor(i / cols) + (i % cols)) * 26}ms`);
  });
  gridEl.classList.add('grid-morph-in');
  const total = (2 * Math.ceil(cells.length / cols)) * 26 + 520;
  window.setTimeout(() => gridEl.classList.remove('grid-morph-in'), total);
}
