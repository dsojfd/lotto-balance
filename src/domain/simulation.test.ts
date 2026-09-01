import { describe, expect, it } from 'vitest';
import type { Draw } from './draw';
import { SeededRandomSource } from './random';
import {
  drawVirtualResult,
  generateSimulationPortfolio,
  summarizeSimulation,
} from './simulation';

const history: Draw[] = [
  { drawNo: 1, drawDate: '2002-12-07', numbers: [3, 5, 12, 20, 27, 35], bonus: 41 },
  { drawNo: 2, drawDate: '2002-12-14', numbers: [1, 9, 18, 23, 34, 42], bonus: 7 },
];

describe('drawVirtualResult', () => {
  it('draws six sorted main numbers and a different bonus number', () => {
    const draw = drawVirtualResult(new SeededRandomSource(20260901));

    expect(draw.numbers).toHaveLength(6);
    expect(new Set(draw.numbers).size).toBe(6);
    expect(draw.numbers).toEqual([...draw.numbers].sort((left, right) => left - right));
    expect(draw.numbers).not.toContain(draw.bonus);
    expect(draw.bonus).toBeGreaterThanOrEqual(1);
    expect(draw.bonus).toBeLessThanOrEqual(45);
  });
});

describe('generateSimulationPortfolio', () => {
  it('creates one hundred unique random games', () => {
    const games = generateSimulationPortfolio(100, 'random', history, new SeededRandomSource(7));

    expect(games).toHaveLength(100);
    expect(new Set(games.map((game) => game.join('-'))).size).toBe(100);
  });

  it('creates one hundred analysis games from draw history', () => {
    const games = generateSimulationPortfolio(100, 'balanced', history, new SeededRandomSource(11));

    expect(games).toHaveLength(100);
    expect(new Set(games.map((game) => game.join('-'))).size).toBe(100);
  });
});

describe('summarizeSimulation', () => {
  it('counts every prize rank, losing games, and the highest rank', () => {
    const draw = { numbers: [1, 2, 3, 4, 5, 6], bonus: 7 } as const;
    const games = [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 7],
      [1, 2, 3, 4, 5, 8],
      [1, 2, 3, 4, 8, 9],
      [1, 2, 3, 8, 9, 10],
      [1, 2, 8, 9, 10, 11],
    ] as const;

    expect(summarizeSimulation(games, draw)).toMatchObject({
      rankCounts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
      losingCount: 1,
      highestRank: 1,
    });
  });
});
