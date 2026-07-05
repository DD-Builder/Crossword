import type { RouteCtx } from '../router';
import { el } from '../../ui/dom';

export function renderSettings(root: HTMLElement, _ctx: RouteCtx): void {
  root.append(
    el('div', { className: 'view-pad' },
      el('h1', { className: 'view-title' }, 'Settings'),
    ),
  );
}
