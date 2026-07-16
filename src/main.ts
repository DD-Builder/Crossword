import './themes/tokens.css';
import './themes/base.css';
import './themes/layout.css';
import './themes/solver.css';
import './themes/skins.css';

import { startRouter, registerView, navigate, currentRoute } from './app/router';
import { applyTheme, watchSystemTheme } from './storage/settings';
import { primeAdaptive } from './stats/adaptive';
import { el } from './ui/dom';

import { renderHome } from './app/views/home';
import { renderPuzzle } from './app/views/puzzle';
import { renderArchive } from './app/views/archive';
import { renderFreePlay } from './app/views/freeplay';
import { renderThemed } from './app/views/themed';
import { renderKids } from './app/views/kids';
import { renderStats } from './app/views/stats';
import { renderInsights } from './app/views/insights';
import { renderSettings } from './app/views/settings';

function buildShell(): HTMLElement {
  const app = document.getElementById('app')!;

  const navItems: [string, string, string][] = [
    ['home', 'Today', ''],
    ['archive', 'Archive', 'archive'],
    ['stats', 'Stats', 'stats'],
    ['settings', 'Settings', 'settings'],
  ];

  const nav = el('nav', {},
    ...navItems.map(([name, label, path]) =>
      el('button', {
        className: 'btn quiet',
        'data-nav': name,
        onclick: () => navigate(path),
      }, label),
    ),
  );

  const header = el('header', { className: 'app-header' },
    el('button', {
      className: 'brand',
      onclick: () => navigate(''),
      'aria-label': 'Riddle Crossword — home',
    }, el('img', {
      className: 'brand-mark',
      src: `${import.meta.env.BASE_URL}icons/favicon.svg`,
      alt: '', 'aria-hidden': 'true',
    }), 'Riddle Crossword'),
    el('div', { className: 'spacer' }),
    nav,
  );

  const viewRoot = el('main', { className: 'view', id: 'view-root' });
  app.replaceChildren(header, viewRoot);

  document.addEventListener('route-changed', () => {
    const name = currentRoute();
    nav.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) => {
      b.classList.toggle('active', b.dataset.nav === name);
    });
    // The solver owns the whole viewport; hide the app chrome there.
    header.style.display = name === 'puzzle' ? 'none' : '';
  });

  return viewRoot;
}

function main(): void {
  applyTheme();
  watchSystemTheme();
  void primeAdaptive().catch(() => {}); // adaptive weights warm up in the background

  registerView('home', renderHome);
  registerView('puzzle', renderPuzzle);
  registerView('archive', renderArchive);
  registerView('free', renderFreePlay);
  registerView('themed', renderThemed);
  registerView('kids', renderKids);
  registerView('stats', renderStats);
  // Not in navItems/the header nav — reachable via a link from Stats. The
  // header nav was recently tuned to just fit 4 tabs on ~390px phones; a 5th
  // permanent tab would risk re-breaking that.
  registerView('insights', renderInsights);
  registerView('settings', renderSettings);
  if (import.meta.env.DEV) {
    // Scene-review gallery — stripped from production builds.
    void import('./app/views/devCelebrations').then(({ renderDevCelebrations }) => {
      registerView('dev', renderDevCelebrations);
      // The initial render may have raced this import; re-route onto it.
      if (location.hash.startsWith('#/dev')) navigate(location.hash.replace(/^#\//, ''));
    });
  }

  startRouter(buildShell());

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }
}

main();
