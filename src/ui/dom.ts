/** Tiny DOM helpers — the app's "framework". */

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'className') {
      node.className = String(v);
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return node;
}

export function frag(...children: (Node | string | null | undefined | false)[]): DocumentFragment {
  const f = document.createDocumentFragment();
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    f.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return f;
}

let toastWrap: HTMLElement | null = null;

export function toast(message: string, ms = 2400): void {
  if (!toastWrap) {
    toastWrap = el('div', { className: 'toast-wrap' });
    document.body.append(toastWrap);
  }
  const t = el('div', { className: 'toast' }, message);
  toastWrap.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s ease';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, ms);
}

export interface ModalHandle { close(): void; body: HTMLElement; }

export function openModal(
  build: (body: HTMLElement, close: () => void) => void,
  opts: { dismissable?: boolean; backdropClass?: string } = {},
): ModalHandle {
  const dismissable = opts.dismissable !== false;
  const body = el('div', { className: 'modal card' });
  const backdrop = el('div', {
    className: `modal-backdrop${opts.backdropClass ? ` ${opts.backdropClass}` : ''}`,
  }, body);
  const close = () => backdrop.remove();
  if (dismissable) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }
  build(body, close);
  document.body.append(backdrop);
  return { close, body };
}
