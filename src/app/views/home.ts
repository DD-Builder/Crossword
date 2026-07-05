import type { RouteCtx } from '../router';
import { el } from '../../ui/dom';

export function renderHome(root: HTMLElement, _ctx: RouteCtx): void {
  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Today'),
      el('p', { className: 'view-sub' }, 'Daily puzzles are on the way — engine under construction.'),
    ),
  );
}
