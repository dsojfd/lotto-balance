import { describe, expect, it } from 'vitest';
import type { Draw } from './draw';
import {
  bootstrapMeanDifferenceInterval,
  conclusionForInterval,
  createWalkForwardSlices,
  matchCombination,
  parseBacktestReport,
  runBacktest,
} from './backtest';

const draws: Draw[] = [
  { drawNo: 1, drawDate: '2002-12-07', numbers: [10, 23, 29, 33, 37, 40], bonus: 16 },
  { drawNo: 2, drawDate: '2002-12-14', numbers: [9, 13, 21, 25, 32, 42], bonus: 2 },
  { drawNo: 3, drawDate: '2002-12-21', numbers: [11, 16, 19, 21, 27, 31], bonus: 30 },
  { drawNo: 4, drawDate: '2002-12-28', numbers: [14, 27, 30, 31, 40, 42], bonus: 2 },
];

const smallConfig = {
  minimumTrainingDraws: 2,
  gamesPerPortfolio: 1,
  portfoliosPerTarget: 1,
  seed: 0x6452026,
} as const;

describe('walk-forward backtest', () => {
  it('excludes the target and every future draw from each training slice', () => {
    const slices = createWalkForwardSlices(draws, 2);

    expect(slices.map((slice) => ({
      training: slice.training.map((draw) => draw.drawNo),
      target: slice.target.drawNo,
    }))).toEqual([
      { training: [1, 2], target: 3 },
      { training: [1, 2, 3], target: 4 },
    ]);
  });

  it('counts main and bonus matches separately', () => {
    expect(matchCombination([1, 2, 3, 4, 5, 9], {
      drawNo: 4,
      drawDate: '2002-12-28',
      numbers: [1, 2, 3, 4, 5, 6],
      bonus: 9,
    })).toEqual({ main: 5, bonus: true });
  });

  it('evaluates balanced and random modes under equal target, game, and repetition counts', () => {
    const report = runBacktest(draws, smallConfig);

    expect(report.evaluation).toEqual({
      targetCount: 2,
      gamesPerPortfolio: 1,
      portfoliosPerTarget: 1,
      totalGamesPerMode: 2,
    });
    expect(report.metrics.balanced.mainMatchDistribution.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(report.metrics.random.mainMatchDistribution.reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  it('repeats the entire report exactly for the same seed', () => {
    expect(runBacktest(draws, smallConfig)).toEqual(runBacktest(draws, smallConfig));
  });

  it('bootstraps target-level differences deterministically with 2,000 resamples', () => {
    const first = bootstrapMeanDifferenceInterval([-1, 1], 123, 2_000);
    const second = bootstrapMeanDifferenceInterval([-1, 1], 123, 2_000);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ confidenceLevel: 0.95, resamples: 2_000 });
    expect(first.lower).toBeLessThanOrEqual(0);
    expect(first.upper).toBeGreaterThanOrEqual(0);
  });

  it('uses the exact no-advantage conclusion whenever the interval includes zero', () => {
    expect(conclusionForInterval({ lower: -0.1, upper: 0.2 })).toBe('무작위 대비 우위 확인 안 됨');
    expect(conclusionForInterval({ lower: 0, upper: 0.2 })).toBe('무작위 대비 우위 확인 안 됨');
  });

  it('fails closed when a typed backtest report has malformed runtime metrics', () => {
    const report = runBacktest(draws, smallConfig);
    const malformed = {
      ...report,
      metrics: {
        ...report.metrics,
        balanced: { ...report.metrics.balanced, mainMatchDistribution: [2, 0] },
      },
    };

    expect(() => parseBacktestReport(malformed)).toThrow();
  });
});
