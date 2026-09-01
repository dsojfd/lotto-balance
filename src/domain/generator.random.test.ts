import { expect, it } from 'vitest';
import { drawUniformCombination, generateRandomPortfolio } from './generator';
import type { RandomSource } from './random';
import { SeededRandomSource } from './random';

it('draws six sorted unique in-range numbers', () => {
  const result = drawUniformCombination(new SeededRandomSource(12345));

  expect(result).toHaveLength(6);
  expect([...new Set(result)]).toHaveLength(6);
  expect(result).toEqual([...result].sort((a, b) => a - b));
  expect(result.every((n) => n >= 1 && n <= 45)).toBe(true);
});

it('never returns a duplicate combination in a portfolio', () => {
  const portfolio = generateRandomPortfolio(10, new SeededRandomSource(7));

  expect(new Set(portfolio.map((numbers) => numbers.join('-'))).size).toBe(10);
});

it('consumes fresh source values for consecutive portfolios', () => {
  const source = new SeededRandomSource(99);

  expect(generateRandomPortfolio(5, source)).not.toEqual(generateRandomPortfolio(5, source));
});

it('fails visibly when a source cannot produce enough unique combinations', () => {
  const candidateBudget = 5 * 100;
  const sourceCallBudget = candidateBudget * 6;
  let attempts = 0;
  const source: RandomSource = {
    nextInt() {
      attempts += 1;
      if (attempts > sourceCallBudget) throw new Error('source exhausted');
      return 0;
    },
  };

  expect(() => generateRandomPortfolio(5, source))
    .toThrow('고유한 추천번호를 생성하지 못했습니다.');
  expect(attempts).toBe(sourceCallBudget);
});
