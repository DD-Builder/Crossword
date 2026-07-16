import { describe, expect, it } from 'vitest';
import { classifyClueStyle } from './clueStyle.ts';

describe('classifyClueStyle', () => {
  it('detects a quoted/pop-culture line', () => {
    expect(classifyClueStyle('"Bohemian Rhapsody" band')).toBe('quoted');
  });

  it('detects fill-in-the-blank', () => {
    expect(classifyClueStyle('___ and improved')).toBe('fill-in-blank');
    expect(classifyClueStyle('Fill in the blank, so to speak')).toBe('fill-in-blank');
  });

  it('detects a wordplay wink', () => {
    expect(classifyClueStyle('Bright thing that dawns on you?')).toBe('wordplay-wink');
  });

  it('detects an abbreviation', () => {
    expect(classifyClueStyle('IRS employee, for short')).toBe('abbreviation');
    expect(classifyClueStyle('NASA vehicle')).toBe('abbreviation');
  });

  it('falls back to straight-definition', () => {
    expect(classifyClueStyle('Domesticated feline')).toBe('straight-definition');
  });

  it('resolves a precedence conflict (quote beats wink) in a documented, deliberate way', () => {
    expect(classifyClueStyle('"Is that so?" she asked')).toBe('quoted');
  });
});
