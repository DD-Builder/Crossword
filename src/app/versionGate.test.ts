import { describe, expect, it } from 'vitest';
import { needsUpdate } from './versionGate.ts';

describe('needsUpdate', () => {
  it('is false when the running build matches the deployed one', () => {
    expect(needsUpdate('0.1.0+a1b2c3d', '0.1.0+a1b2c3d')).toBe(false);
  });

  it('is true when the commit differs, even with the same package version', () => {
    expect(needsUpdate('0.1.0+a1b2c3d', '0.1.0+f9e8d7c')).toBe(true);
  });

  it('is true when the package version differs', () => {
    expect(needsUpdate('0.1.0+a1b2c3d', '0.2.0+a1b2c3d')).toBe(true);
  });
});
