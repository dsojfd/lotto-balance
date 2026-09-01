import { describe, expect, it } from 'vitest';
import { analyzeDraws, extractShape } from './analysis';
import type { Draw } from './draw';

const draws: Draw[] = [
  { drawNo: 1, drawDate: '2002-12-07', numbers: [1, 2, 3, 10, 20, 45], bonus: 9 },
  { drawNo: 2, drawDate: '2002-12-14', numbers: [1, 7, 14, 21, 28, 35], bonus: 2 },
  { drawNo: 3, drawDate: '2002-12-21', numbers: [7, 8, 18, 28, 38, 45], bonus: 11 },
];

describe('extractShape', () => {
  it('describes occupied fixed sections separately from five fixed range counts', () => {
    expect(extractShape([1, 2, 11, 12, 22, 45])).toEqual({
      oddCount: 3,
      lowCount: 5,
      sum: 93,
      range: 44,
      sectionCount: 4,
      adjacentPairs: 2,
      duplicateEndings: 3,
    });
  });
});

describe('analyzeDraws', () => {
  it('computes descriptive frequency, completed-draw absence, and pair counts', () => {
    const window = analyzeDraws(draws).windows.all;

    expect(window.drawCount).toBe(3);
    expect(window.numbers[0]).toEqual({
      number: 1,
      appearances: 2,
      expected: 0.4,
      delta: 1.6,
      absence: 1,
    });
    expect(window.numbers[44]).toMatchObject({ number: 45, appearances: 2, absence: 0 });
    expect(window.numbers[3]).toMatchObject({ number: 4, appearances: 0, absence: 3 });
    expect(window.pairCounts['1-2']).toBe(1);
    expect(window.pairCounts['7-28']).toBe(2);
    expect(window.pairSampleSize).toBe(3);
  });

  it('records hand-derived shapes and five fixed-range count histograms', () => {
    const window = analyzeDraws(draws).windows.all;

    expect(window.shapeHistograms.oddCount).toEqual({ 2: 1, 3: 1, 4: 1 });
    expect(window.shapeHistograms.lowCount).toEqual({ 3: 1, 4: 1, 5: 1 });
    expect(window.shapeHistograms.sectionCount).toEqual({ 3: 1, 4: 1, 5: 1 });
    expect(window.shapeHistograms.adjacentPairs).toEqual({ 0: 1, 1: 1, 2: 1 });
    expect(window.shapeHistograms.duplicateEndings).toEqual({ 1: 2, 3: 1 });
    expect(window.fixedSectionCounts).toEqual({
      '1-10': { 2: 2, 4: 1 },
      '11-20': { 1: 3 },
      '21-30': { 0: 1, 1: 1, 2: 1 },
      '31-40': { 0: 1, 1: 2 },
      '41-45': { 0: 1, 1: 2 },
    });
  });

  it('histograms main-number overlap counts across consecutive-draw transitions', () => {
    const window = analyzeDraws(draws).windows.all;

    expect(window.previousDrawReuse).toEqual({
      0: 0,
      1: 1,
      2: 1,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    });
    expect(window.previousDrawReuseSampleSize).toBe(2);
    expect(Object.values(window.previousDrawReuse).reduce((total, count) => total + count, 0))
      .toBe(window.previousDrawReuseSampleSize);
  });

  it('uses each available draw when a requested recent window is larger than the history', () => {
    const report = analyzeDraws(draws);

    expect(report.windows['10'].drawCount).toBe(3);
    expect(report.windows['30'].pairSampleSize).toBe(3);
    expect(report.windows['50'].previousDrawReuseSampleSize).toBe(2);
    expect(report.windows['100'].numbers[0].absence).toBe(1);
  });

  it('uses the last ten draws rather than the first ten draws', () => {
    const elevenDraws: Draw[] = [
      { drawNo: 1, drawDate: '2002-12-07', numbers: [1, 2, 3, 4, 5, 6], bonus: 7 },
      ...Array.from({ length: 10 }, (_, index): Draw => ({
        drawNo: index + 2,
        drawDate: `2003-01-${String(index + 1).padStart(2, '0')}`,
        numbers: [7, 8, 9, 10, 11, 12],
        bonus: 13,
      })),
    ];

    const window = analyzeDraws(elevenDraws).windows['10'];
    expect(window.drawCount).toBe(10);
    expect(window.numbers[0]).toMatchObject({ number: 1, appearances: 0, absence: 10 });
    expect(window.numbers[6]).toMatchObject({ number: 7, appearances: 10, absence: 0 });
  });

  it('reports no consecutive-draw comparisons for a one-draw history', () => {
    const window = analyzeDraws([draws[2]]).windows.all;

    expect(window.previousDrawReuseSampleSize).toBe(0);
    expect(window.previousDrawReuse).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  });
});
