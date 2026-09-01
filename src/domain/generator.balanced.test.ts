import { describe, expect, it, vi } from 'vitest';
import { extractShape } from './analysis';
import type { Combination, Draw } from './draw';
import {
  buildShapeModel,
  generateBalancedPortfolio,
  scoreCombination,
  selectDiverseCandidates,
} from './generator';
import { SeededRandomSource } from './random';
import type { RandomSource } from './random';

const commonShapeCombination: Combination = [1, 8, 15, 22, 29, 36];
const renumberedSameShape: Combination = [3, 6, 19, 21, 24, 38];
const consecutiveCombination: Combination = [1, 2, 3, 4, 5, 6];

function draw(drawNo: number, numbers: Combination, bonus = 45): Draw {
  return {
    drawNo,
    drawDate: `2026-08-${String(drawNo).padStart(2, '0')}`,
    numbers,
    bonus,
  };
}

describe('balanced shape scoring', () => {
  it('builds only the seven whole-combination shape histograms', () => {
    expect(buildShapeModel([
      draw(1, commonShapeCombination),
      draw(2, consecutiveCombination, 7),
    ])).toEqual({
      oddCount: { 3: 2 },
      lowCount: { 4: 1, 6: 1 },
      sum: { 21: 1, 111: 1 },
      range: { 5: 1, 35: 1 },
      sectionCount: { 1: 1, 4: 1 },
      adjacentPairs: { 0: 1, 5: 1 },
      duplicateEndings: { 0: 2 },
    });
  });

  it('averages each candidate bucket count divided by that field largest bucket', () => {
    const model = {
      oddCount: { 3: 2, 4: 4 },
      lowCount: { 3: 2, 4: 1 },
      sum: { 100: 3, 111: 3 },
      range: { 35: 1, 40: 4 },
      sectionCount: { 4: 4 },
      adjacentPairs: { 0: 2, 1: 4 },
      duplicateEndings: { 0: 1, 1: 5 },
    };

    expect(scoreCombination(commonShapeCombination, model, false))
      .toBeCloseTo((0.5 + 0.5 + 1 + 0.25 + 1 + 0.5 + 0.2) / 7, 12);
  });

  it('uses identical whole-shape inputs equally despite different number appearances', () => {
    const literalShape = {
      oddCount: 3,
      lowCount: 4,
      sum: 111,
      range: 35,
      sectionCount: 4,
      adjacentPairs: 0,
      duplicateEndings: 0,
    };
    expect(extractShape(commonShapeCombination)).toEqual(literalShape);
    expect(extractShape(renumberedSameShape)).toEqual(literalShape);

    const model = buildShapeModel([
      draw(1, commonShapeCombination),
      draw(2, commonShapeCombination),
      draw(3, commonShapeCombination),
      draw(4, consecutiveCombination, 7),
    ]);

    expect(scoreCombination(commonShapeCombination, model, false))
      .toBe(scoreCombination(renumberedSameShape, model, false));
  });

  it('applies optional popularity heuristics cumulatively without changing the base score', () => {
    const allBirthdayAndConsecutive: Combination = [1, 2, 3, 4, 5, 6];
    const allBirthdayAndRepeatedEnding: Combination = [1, 11, 21, 24, 27, 30];

    const consecutiveModel = buildShapeModel([draw(1, allBirthdayAndConsecutive, 7)]);
    expect(scoreCombination(allBirthdayAndConsecutive, consecutiveModel, false)).toBe(1);
    expect(scoreCombination(allBirthdayAndConsecutive, consecutiveModel, true)).toBeCloseTo(0.8 * 0.7, 12);

    const repeatedEndingModel = buildShapeModel([draw(1, allBirthdayAndRepeatedEnding, 45)]);
    expect(scoreCombination(allBirthdayAndRepeatedEnding, repeatedEndingModel, false)).toBe(1);
    expect(scoreCombination(allBirthdayAndRepeatedEnding, repeatedEndingModel, true)).toBeCloseTo(0.8 * 0.9, 12);
  });
});

describe('diversified selection', () => {
  it('selects a less-overlapping candidate when shape scores tie', () => {
    const candidates: Combination[] = [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 7, 8],
      [9, 10, 11, 12, 13, 14],
    ];

    expect(selectDiverseCandidates(candidates, 2, () => 1)).toEqual([
      [1, 2, 3, 4, 5, 6],
      [9, 10, 11, 12, 13, 14],
    ]);
  });

  it('uses the highest shape score for the first selection', () => {
    const lowKey: Combination = [1, 2, 3, 4, 5, 6];
    const highScore: Combination = [9, 10, 11, 12, 13, 14];

    expect(selectDiverseCandidates(
      [lowKey, highScore],
      1,
      (candidate) => candidate === lowKey ? 0.5 : 1,
    )).toEqual([highScore]);
  });

  it('uses combination key as the final tie-breaker', () => {
    const lexicalFirst: Combination = [10, 11, 12, 13, 14, 15];
    const lexicalSecond: Combination = [9, 10, 11, 12, 13, 14];

    expect(selectDiverseCandidates(
      [lexicalSecond, lexicalFirst],
      1,
      () => 1,
    )).toEqual([lexicalFirst]);
  });

  it('weights later shape and diversity scores at seventy and thirty percent', () => {
    const first: Combination = [1, 2, 3, 4, 5, 6];
    const higherShapeWithOverlap: Combination = [1, 2, 3, 4, 20, 21];
    const lowerShapeWithoutOverlap: Combination = [9, 10, 11, 12, 13, 14];
    const scores = new Map<Combination, number>([
      [first, 1],
      [higherShapeWithOverlap, 0.89],
      [lowerShapeWithoutOverlap, 0.6],
    ]);

    expect(selectDiverseCandidates(
      [lowerShapeWithoutOverlap, higherShapeWithOverlap, first],
      2,
      (candidate) => scores.get(candidate)!,
    )).toEqual([first, higherShapeWithOverlap]);
  });
});

describe('balanced portfolio generation', () => {
  const trainingDraws = [
    draw(1, commonShapeCombination),
    draw(2, renumberedSameShape, 45),
    draw(3, consecutiveCombination, 7),
  ];

  it.each([1, 5, 10] as const)('returns %i sorted valid unique combinations', (count) => {
    const portfolio = generateBalancedPortfolio(
      count,
      trainingDraws,
      new SeededRandomSource(1000 + count),
      { avoidPopular: false },
    );

    expect(portfolio).toHaveLength(count);
    expect(new Set(portfolio.map((numbers) => numbers.join('-'))).size).toBe(count);
    portfolio.forEach((numbers) => {
      expect(numbers).toEqual([...numbers].sort((left, right) => left - right));
      expect(new Set(numbers).size).toBe(6);
      expect(numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 45)).toBe(true);
    });
  });

  it('is deterministic for independently seeded sources and never consults Math.random', () => {
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });

    try {
      const first = generateBalancedPortfolio(
        5,
        trainingDraws,
        new SeededRandomSource(2468),
        { avoidPopular: true },
      );
      const second = generateBalancedPortfolio(
        5,
        trainingDraws,
        new SeededRandomSource(2468),
        { avoidPopular: true },
      );
      expect(first).toEqual(second);
    } finally {
      mathRandom.mockRestore();
    }
  });

  it('fails visibly within the existing per-target retry budget for a degenerate source', () => {
    const candidatePoolSize = 2500;
    const sourceCallBudget = candidatePoolSize * 100 * 6;
    let sourceCalls = 0;
    const source: RandomSource = {
      nextInt() {
        sourceCalls += 1;
        if (sourceCalls > sourceCallBudget) throw new Error('source guard exceeded');
        return 0;
      },
    };

    expect(() => generateBalancedPortfolio(
      1,
      trainingDraws,
      source,
      { avoidPopular: false },
    )).toThrow('고유한 추천번호를 생성하지 못했습니다.');
    expect(sourceCalls).toBe(sourceCallBudget);
  });
});
