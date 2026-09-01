import { describe, expect, it } from 'vitest';
import { checkCombination } from './rank';

const draw = {
  drawNo: 1,
  drawDate: '2002-12-07',
  numbers: [1, 2, 3, 4, 5, 6] as const,
  bonus: 7,
};

describe('checkCombination', () => {
  it.each([
    [[1, 2, 3, 4, 5, 6], 6, false, 1],
    [[1, 2, 3, 4, 5, 7], 5, true, 2],
    [[1, 2, 3, 4, 5, 8], 5, false, 3],
    [[1, 2, 3, 4, 8, 9], 4, false, 4],
    [[1, 2, 3, 8, 9, 10], 3, false, 5],
    [[1, 2, 8, 9, 10, 11], 2, false, null],
    [[7, 8, 9, 10, 11, 12], 0, true, null],
  ] as const)('returns the exact rank for %j', (numbers, mainMatches, bonusMatched, rank) => {
    expect(checkCombination(numbers, draw)).toEqual({ mainMatches, bonusMatched, rank });
  });
});
