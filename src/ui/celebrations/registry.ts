/** Scene registry: 3 bespoke victory scenes per skin. `pickScene` is seeded
 * so a given daily shows everyone the same spectacle ("did you get the
 * aurora today?") while different days rotate through all three. */

import { rngFrom } from '../../core/rng.ts';
import type { Scene } from './types.ts';
import { classicScenes } from './scenes/classic.ts';

const REGISTRY: Record<string, Scene[]> = {
  classic: classicScenes,
};

export const SCENE_SKINS = Object.keys(REGISTRY);

export function scenesFor(skin: string): Scene[] {
  return REGISTRY[skin] ?? REGISTRY['classic']!;
}

export function pickScene(skin: string, seedKey: string): Scene {
  const scenes = scenesFor(skin);
  return scenes[rngFrom(`scene|${seedKey}`).int(scenes.length)]!;
}

export function sceneById(id: string): Scene | undefined {
  for (const scenes of Object.values(REGISTRY)) {
    const hit = scenes.find((s) => s.id === id);
    if (hit) return hit;
  }
  return undefined;
}
