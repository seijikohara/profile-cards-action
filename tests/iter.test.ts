import { describe, expect, it } from 'vitest';
import { range } from '../src/iter.js';

describe('range', () => {
  it('produces [start .. start + length - 1]', () => {
    expect(range(4)).toEqual([0, 1, 2, 3]);
    expect(range(3, 1)).toEqual([1, 2, 3]);
  });

  it('is empty for zero or negative lengths', () => {
    expect(range(0)).toEqual([]);
    expect(range(-2)).toEqual([]);
  });
});
