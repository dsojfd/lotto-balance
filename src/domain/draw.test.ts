import { describe, expect, it } from 'vitest';
import { combinationKey, parseDrawDataset } from './draw';

const valid = {
  schemaVersion: 1,
  generatedAt: '2026-09-01T00:00:00.000Z',
  latestDraw: 2,
  sourceUrl: 'https://www.dhlottery.co.kr/lt645/result',
  draws: [
    { drawNo: 1, drawDate: '2002-12-07', numbers: [10, 23, 29, 33, 37, 40], bonus: 16 },
    { drawNo: 2, drawDate: '2002-12-14', numbers: [9, 13, 21, 25, 32, 42], bonus: 2 },
  ],
};

describe('parseDrawDataset', () => {
  it('accepts a complete consecutive dataset', () => {
    expect(parseDrawDataset(valid).latestDraw).toBe(2);
  });

  it.each([
    ['duplicate number', { ...valid, draws: [{ ...valid.draws[0], numbers: [10, 10, 29, 33, 37, 40] }, valid.draws[1]] }],
    ['out of range', { ...valid, draws: [{ ...valid.draws[0], numbers: [0, 23, 29, 33, 37, 40] }, valid.draws[1]] }],
    ['bonus collision', { ...valid, draws: [{ ...valid.draws[0], bonus: 10 }, valid.draws[1]] }],
    ['draw gap', { ...valid, latestDraw: 3, draws: [valid.draws[0], { ...valid.draws[1], drawNo: 3 }] }],
    ['invalid calendar date', { ...valid, draws: [{ ...valid.draws[0], drawDate: '2002-02-29' }, valid.draws[1]] }],
    ['non-increasing draw date', { ...valid, draws: [valid.draws[0], { ...valid.draws[1], drawDate: '2002-12-07' }] }],
    ['normalized invalid generation timestamp', { ...valid, generatedAt: '2026-02-31T00:00:00.000Z' }],
  ])('rejects %s', (_name, raw) => {
    expect(() => parseDrawDataset(raw)).toThrow();
  });
});

it('builds a stable hyphen-separated key from the six winning numbers', () => {
  expect(combinationKey([1, 9, 17, 28, 34, 45])).toBe('1-9-17-28-34-45');
});
