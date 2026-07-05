/**
 * Hash router. Routes are matched by first segment; the rest is params.
 *   #/                     → home
 *   #/puzzle/<id>          → solver (id encodes kind/date/config)
 *   #/archive  #/free  #/themed  #/kids  #/stats  #/settings
 */

export interface RouteCtx {
  /** Path segments after the view name, URI-decoded. */
  params: string[];
  /** Query params after '?' in the hash. */
  query: URLSearchParams;
}

export type ViewRenderer = (root: HTMLElement, ctx: RouteCtx) => void | (() => void);

const routes = new Map<string, ViewRenderer>();
let root: HTMLElement | null = null;
let cleanup: (() => void) | null = null;
let currentPath = '';

export function registerView(name: string, render: ViewRenderer): void {
  routes.set(name, render);
}

export function navigate(path: string): void {
  const target = `#/${path.replace(/^#?\/?/, '')}`;
  if (location.hash === target) render();
  else location.hash = target;
}

export function currentRoute(): string {
  return currentPath;
}

function parse(): { name: string; ctx: RouteCtx } {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart = '', queryPart = ''] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  return {
    name: segs[0] ?? 'home',
    ctx: { params: segs.slice(1), query: new URLSearchParams(queryPart) },
  };
}

function render(): void {
  if (!root) return;
  const { name, ctx } = parse();
  const view = routes.get(name) ?? routes.get('home');
  if (!view) return;
  cleanup?.();
  cleanup = null;
  currentPath = name;
  root.replaceChildren();
  root.scrollTop = 0;
  const out = view(root, ctx);
  if (typeof out === 'function') cleanup = out;
  document.dispatchEvent(new CustomEvent('route-changed', { detail: { name } }));
}

export function startRouter(appRoot: HTMLElement): void {
  root = appRoot;
  window.addEventListener('hashchange', render);
  render();
}
