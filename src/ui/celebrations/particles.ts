/** Shared scene primitives: easing, color math, a pooled particle system,
 * and light field helpers. Pure math — no DOM, unit-testable. */

export const TAU = Math.PI * 2;

/* --- Easing ---------------------------------------------------------------- */

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const easeOutCubic = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
export const easeOutQuint = (t: number): number => 1 - (1 - clamp01(t)) ** 5;
export const easeInCubic = (t: number): number => clamp01(t) ** 3;
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp01(t);
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
/** Bouncy settle (drop-in for squash-and-stretch landings). */
export const easeOutBounce = (t: number): number => {
  const n1 = 7.5625;
  const d1 = 2.75;
  let x = clamp01(t);
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

/* --- Color ------------------------------------------------------------------ */

/** Parse '#rgb', '#rrggbb', 'rgb(…)' or 'rgba(…)' → [r,g,b,a]. */
export function parseColor(color: string): [number, number, number, number] {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const n = (s: string): number => parseInt(s, 16);
    if (hex.length === 3) return [n(hex[0]! + hex[0]!), n(hex[1]! + hex[1]!), n(hex[2]! + hex[2]!), 1];
    if (hex.length >= 6) {
      const a = hex.length === 8 ? n(hex.slice(6, 8)) / 255 : 1;
      return [n(hex.slice(0, 2)), n(hex.slice(2, 4)), n(hex.slice(4, 6)), a];
    }
  }
  const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
  return [128, 128, 128, 1];
}

export function withAlpha(color: string, alpha: number): string {
  const [r, g, b, a] = parseColor(color);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(a * alpha)})`;
}

export function mixColor(colorA: string, colorB: string, t: number): string {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  const x = clamp01(t);
  return `rgba(${Math.round(lerp(a[0], b[0], x))}, ${Math.round(lerp(a[1], b[1], x))}, ` +
    `${Math.round(lerp(a[2], b[2], x))}, ${lerp(a[3], b[3], x).toFixed(3)})`;
}

/** Perceived luminance 0..1 — lets scenes adapt to light/dark surfaces. */
export function luminance(color: string): number {
  const [r, g, b] = parseColor(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* --- Particles --------------------------------------------------------------- */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived / total lifespan. */
  age: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  alpha: number;
  /** Scene-specific scratch values (phase offsets, indices…). */
  seed: number;
  dead: boolean;
}

export interface ParticlePhysics {
  gravity?: number;
  drag?: number;
  /** Custom per-particle behavior, runs after the built-ins. */
  update?(p: Particle, dt: number, t: number): void;
}

/** Fixed-capacity pool: spawn recycles dead slots, no GC churn mid-scene. */
export class ParticleSystem {
  readonly pool: Particle[] = [];
  private cursor = 0;

  constructor(readonly capacity: number) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1,
        rot: 0, vr: 0, color: '#fff', alpha: 1, seed: 0, dead: true,
      });
    }
  }

  spawn(init: Partial<Particle>): Particle | null {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[(this.cursor + i) % this.capacity]!;
      if (!p.dead) continue;
      this.cursor = (this.cursor + i + 1) % this.capacity;
      Object.assign(p, {
        x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1,
        rot: 0, vr: 0, color: '#fff', alpha: 1, seed: Math.random(), dead: false,
      }, init);
      return p;
    }
    return null; // pool exhausted — scene overspawned; drop quietly
  }

  update(dt: number, t: number, physics: ParticlePhysics = {}): void {
    const drag = physics.drag ?? 0;
    const gravity = physics.gravity ?? 0;
    for (const p of this.pool) {
      if (p.dead) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.dead = true;
        continue;
      }
      p.vy += gravity * dt;
      if (drag > 0) {
        const k = Math.max(0, 1 - drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      physics.update?.(p, dt, t);
    }
  }

  each(fn: (p: Particle) => void): void {
    for (const p of this.pool) if (!p.dead) fn(p);
  }

  get alive(): number {
    let n = 0;
    for (const p of this.pool) if (!p.dead) n++;
    return n;
  }
}

/* --- Fields ------------------------------------------------------------------ */

/** Cheap curl-ish flow field (sum of drifting sines) for organic swirls. */
export function flow(x: number, y: number, t: number, scale = 0.004): [number, number] {
  const a = Math.sin(y * scale * 2.1 + t * 0.7) + Math.cos(x * scale * 1.3 - t * 0.4);
  const b = Math.cos(x * scale * 1.7 + t * 0.5) - Math.sin(y * scale * 1.1 + t * 0.6);
  return [a, b];
}

/** Deterministic 1D value noise in [-1, 1] (phase-shifted sines). */
export function wobble(seed: number, t: number): number {
  return (
    Math.sin(t * 1.7 + seed * 12.9) * 0.55 +
    Math.sin(t * 3.1 + seed * 78.2) * 0.3 +
    Math.sin(t * 5.3 + seed * 37.7) * 0.15
  );
}
