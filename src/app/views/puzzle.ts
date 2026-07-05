import type { RouteCtx } from '../router';
import { el } from '../../ui/dom';

export function renderPuzzle(root: HTMLElement, ctx: RouteCtx): void {
  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Puzzle'),
      el('p', { className: 'view-sub' }, `Loading ${ctx.params.join('/') || '…'}`),
    ),
  );
}
