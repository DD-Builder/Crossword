/** Dev-only gallery for hand-reviewing every victory scene under every skin
 * and mode. Registered in main.ts behind import.meta.env.DEV, so it's
 * dead-code-eliminated from production builds.
 *
 *   #/dev                         gallery of all skins × scenes
 *   #/dev?scene=classic/typewriter&mode=dark   deep link + autoplay
 */

import type { RouteCtx } from '../router.ts';
import { el } from '../../ui/dom.ts';
import { playScene, type PlayHandle } from '../../ui/celebrations/engine.ts';
import { sceneById, scenesFor } from '../../ui/celebrations/registry.ts';

const ALL_SKINS = [
  'classic', 'midnight', 'botanical', 'art-deco', 'ocean', 'terracotta',
  'mono', 'beach', 'harvest', 'hearth', 'lisa-frank',
];

export function renderDevCelebrations(root: HTMLElement, ctx: RouteCtx): () => void {
  const prevSkin = document.documentElement.dataset.skin;
  const prevMode = document.documentElement.dataset.mode;
  let handle: PlayHandle | null = null;
  let seedTick = 0;

  const status = el('p', { className: 'muted' }, 'Pick a scene. Same scene twice = same seed; “replay” varies it.');

  const play = (id: string): void => {
    const scene = sceneById(id);
    if (!scene) return;
    handle?.stop();
    document.documentElement.dataset.skin = scene.skin;
    status.textContent = `▶ ${id} (skin ${scene.skin}, ${document.documentElement.dataset.mode ?? 'light'})`;
    handle = playScene(scene, {
      seedKey: `dev|${id}|${seedTick++}`,
      title: 'The Daily Preview',
      timeText: '4:07',
      gridRect: { x: innerWidth * 0.3, y: innerHeight * 0.3, w: innerWidth * 0.4, h: innerHeight * 0.4 },
    });
  };

  const modeBtn = el('button', { className: 'btn' }, 'Toggle dark');
  modeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.mode = next;
  });

  const grid = el('div', { className: 'settings-group' });
  for (const skin of ALL_SKINS) {
    const scenes = scenesFor(skin);
    const isFallback = scenes[0]?.skin !== skin;
    grid.append(
      el('h3', {}, skin + (isFallback ? ' (fallback: classic)' : '')),
      el('div', { className: 'picker-row' },
        ...scenes.map((s) =>
          el('button', { className: 'chip', onclick: () => play(s.id) }, s.id.split('/')[1] ?? s.id),
        ),
      ),
    );
  }

  root.append(
    el('div', { className: 'page' },
      el('h2', {}, 'Celebration gallery (dev)'),
      el('div', { className: 'picker-row' }, modeBtn),
      status,
      grid,
    ),
  );

  const deepLink = ctx.query.get('scene');
  if (deepLink) {
    if (ctx.query.get('mode') === 'dark') document.documentElement.dataset.mode = 'dark';
    setTimeout(() => play(deepLink), 100);
  }

  return () => {
    handle?.stop();
    if (prevSkin) document.documentElement.dataset.skin = prevSkin;
    if (prevMode) document.documentElement.dataset.mode = prevMode;
  };
}
