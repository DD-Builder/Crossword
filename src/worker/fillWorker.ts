/** Web Worker: run grid fills off the main thread. The worker receives the
 * bank entries once (init) and then fills on demand. */

import { buildIndex, type BankIndex } from '../core/generator/index.ts';
import { fill, type FillOptions } from '../core/generator/filler.ts';
import { templateToGrid } from '../core/grid.ts';
import { rngFrom } from '../core/rng.ts';
import type { BankEntry } from '../core/types.ts';

export interface FillRequest {
  type: 'fill';
  requestId: number;
  template: { size: number; blocks: [number, number][] };
  seedKey: string;
  options?: FillOptions & { deadlineMs?: number };
  /** Restart budget: attempts with seedKey+n before giving up. */
  restarts?: number;
}

export interface InitRequest {
  type: 'init';
  entries: BankEntry[];
}

export interface FillResponse {
  type: 'fill-result';
  requestId: number;
  ok: boolean;
  grid?: string[];
  placedAnswers?: Record<string, string>; // slotId → answer
  attempts: number;
  reason?: string;
}

let bank: BankIndex | null = null;

self.onmessage = (event: MessageEvent<FillRequest | InitRequest>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    bank = buildIndex(msg.entries);
    (self as unknown as Worker).postMessage({ type: 'ready' });
    return;
  }

  if (msg.type === 'fill') {
    if (!bank) {
      (self as unknown as Worker).postMessage({
        type: 'fill-result', requestId: msg.requestId, ok: false, attempts: 0, reason: 'not-initialized',
      } satisfies FillResponse);
      return;
    }
    const template = templateToGrid(msg.template.size, msg.template.blocks);
    const restarts = msg.restarts ?? 4;
    const deadline = performance.now() + (msg.options?.deadlineMs ?? 6000);
    let lastReason = 'no-candidates';

    for (let attempt = 0; attempt <= restarts; attempt++) {
      if (performance.now() > deadline) {
        lastReason = 'deadline';
        break;
      }
      const rng = rngFrom(`${msg.seedKey}|r${attempt}`);
      const result = fill(template, bank, rng, msg.options);
      if (result.ok) {
        const placedAnswers: Record<string, string> = {};
        for (const [slotId, entry] of result.placed!) placedAnswers[slotId] = entry.answer;
        (self as unknown as Worker).postMessage({
          type: 'fill-result',
          requestId: msg.requestId,
          ok: true,
          grid: result.grid,
          placedAnswers,
          attempts: attempt + 1,
        } satisfies FillResponse);
        return;
      }
      lastReason = result.reason ?? 'no-candidates';
      // seed-unplaceable won't change with a new rng ordering unless there
      // are alternative slots; one retry is enough to know.
      if (lastReason === 'seed-unplaceable' && attempt >= 1) break;
    }

    (self as unknown as Worker).postMessage({
      type: 'fill-result',
      requestId: msg.requestId,
      ok: false,
      attempts: restarts + 1,
      reason: lastReason,
    } satisfies FillResponse);
  }
};
