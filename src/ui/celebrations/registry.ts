/** Scene registry: 3 bespoke victory scenes per skin. `pickScene` is seeded
 * so a given daily shows everyone the same spectacle ("did you get the
 * aurora today?") while different days rotate through all three. */

import { rngFrom } from '../../core/rng.ts';
import type { Scene } from './types.ts';
import { classicScenes } from './scenes/classic.ts';
import { midnightScenes } from './scenes/midnight.ts';
import { oceanScenes } from './scenes/ocean.ts';
import { botanicalScenes } from './scenes/botanical.ts';
import { artDecoScenes } from './scenes/art-deco.ts';
import { terracottaScenes } from './scenes/terracotta.ts';
import { monoScenes } from './scenes/mono.ts';
import { hearthScenes } from './scenes/hearth.ts';
import { beachScenes } from './scenes/beach.ts';
import { harvestScenes } from './scenes/harvest.ts';
import { lisaFrankScenes } from './scenes/lisa-frank.ts';

const REGISTRY: Record<string, Scene[]> = {
  classic: classicScenes,
  midnight: midnightScenes,
  ocean: oceanScenes,
  botanical: botanicalScenes,
  'art-deco': artDecoScenes,
  terracotta: terracottaScenes,
  mono: monoScenes,
  hearth: hearthScenes,
  beach: beachScenes,
  harvest: harvestScenes,
  'lisa-frank': lisaFrankScenes,
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
