import type { Combination, Draw } from './draw';
import {
  buildShapeModel,
  generateBalancedPortfolioFromModel,
  generateRandomPortfolio,
} from './generator';
import { SeededRandomSource } from './random';

export const DEFAULT_BACKTEST_CONFIG = {
  minimumTrainingDraws: 100,
  gamesPerPortfolio: 5,
  portfoliosPerTarget: 20,
  seed: 0x6452026,
} as const;

export const BACKTEST_BOOTSTRAP_RESAMPLES = 2_000;

export interface BacktestConfig {
  minimumTrainingDraws: number;
  gamesPerPortfolio: 1 | 5 | 10;
  portfoliosPerTarget: number;
  seed: number;
}

export interface WalkForwardSlice {
  training: readonly Draw[];
  target: Draw;
}

export interface MatchResult {
  main: number;
  bonus: boolean;
}

export type MainMatchDistribution = [number, number, number, number, number, number, number];

export interface ModeBacktestMetrics {
  mainMatchDistribution: MainMatchDistribution;
  meanMainMatches: number;
  matchCounts: {
    '3': number;
    '4': number;
    '5': number;
    '6': number;
  };
  bonusMatches: number;
}

export interface BootstrapInterval {
  lower: number;
  upper: number;
  confidenceLevel: 0.95;
  resamples: 2_000;
}

export interface BacktestReport {
  schemaVersion: 1;
  latestDraw: number;
  config: BacktestConfig;
  evaluation: {
    targetCount: number;
    gamesPerPortfolio: BacktestConfig['gamesPerPortfolio'];
    portfoliosPerTarget: number;
    totalGamesPerMode: number;
  };
  metrics: {
    balanced: ModeBacktestMetrics;
    random: ModeBacktestMetrics;
  };
  meanMainMatchDifference: number;
  interval: BootstrapInterval;
  conclusion: string;
}

const MODE_SEED_TAGS = {
  balanced: 0x62616c61,
  random: 0x72616e64,
  bootstrap: 0x62737472,
} as const;

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

function validateConfig(config: BacktestConfig): void {
  assertPositiveInteger(config.minimumTrainingDraws, 'minimumTrainingDraws');
  if (config.gamesPerPortfolio !== 1
    && config.gamesPerPortfolio !== 5
    && config.gamesPerPortfolio !== 10) {
    throw new RangeError('gamesPerPortfolio must be 1, 5, or 10.');
  }
  assertPositiveInteger(config.portfoliosPerTarget, 'portfoliosPerTarget');
  if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffff_ffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer.');
  }
}

function mixSeed(seed: number, tag: number, targetDrawNo: number, repetition: number): number {
  let value = (seed ^ tag) >>> 0;
  value = Math.imul(value ^ (targetDrawNo >>> 0), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13) ^ (repetition >>> 0), 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export function createWalkForwardSlices(
  draws: readonly Draw[],
  minimumTrainingDraws: number,
): WalkForwardSlice[] {
  assertPositiveInteger(minimumTrainingDraws, 'minimumTrainingDraws');

  return draws.slice(minimumTrainingDraws).map((target, offset) => {
    const targetIndex = minimumTrainingDraws + offset;
    return {
      training: draws.slice(0, targetIndex),
      target,
    };
  });
}

export function matchCombination(numbers: Combination, target: Draw): MatchResult {
  const targetNumbers = new Set(target.numbers);
  return {
    main: numbers.filter((number) => targetNumbers.has(number)).length,
    bonus: numbers.includes(target.bonus),
  };
}

function createDistribution(): MainMatchDistribution {
  return [0, 0, 0, 0, 0, 0, 0];
}

interface MutableModeTotals {
  distribution: MainMatchDistribution;
  mainMatchTotal: number;
  bonusMatches: number;
}

function recordPortfolio(
  portfolio: readonly Combination[],
  target: Draw,
  totals: MutableModeTotals,
): number {
  let targetMainTotal = 0;
  portfolio.forEach((combination) => {
    const result = matchCombination(combination, target);
    totals.distribution[result.main] += 1;
    totals.mainMatchTotal += result.main;
    targetMainTotal += result.main;
    if (result.bonus) totals.bonusMatches += 1;
  });
  return targetMainTotal;
}

function summarizeMode(totals: MutableModeTotals, totalGames: number): ModeBacktestMetrics {
  return {
    mainMatchDistribution: totals.distribution,
    meanMainMatches: totals.mainMatchTotal / totalGames,
    matchCounts: {
      '3': totals.distribution[3],
      '4': totals.distribution[4],
      '5': totals.distribution[5],
      '6': totals.distribution[6],
    },
    bonusMatches: totals.bonusMatches,
  };
}

function percentile(sortedValues: readonly number[], probability: number): number {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(probability * sortedValues.length) - 1),
  );
  return sortedValues[index];
}

export function bootstrapMeanDifferenceInterval(
  targetDifferences: readonly number[],
  seed: number,
  resamples: 2_000 = BACKTEST_BOOTSTRAP_RESAMPLES,
): BootstrapInterval {
  if (targetDifferences.length === 0 || targetDifferences.some((value) => !Number.isFinite(value))) {
    throw new RangeError('targetDifferences must contain finite values.');
  }
  if (resamples !== BACKTEST_BOOTSTRAP_RESAMPLES) {
    throw new RangeError(`bootstrap resamples must be ${BACKTEST_BOOTSTRAP_RESAMPLES}.`);
  }

  const source = new SeededRandomSource(
    mixSeed(seed, MODE_SEED_TAGS.bootstrap, targetDifferences.length, resamples),
  );
  const bootstrapMeans = Array.from({ length: resamples }, () => {
    let sum = 0;
    for (let index = 0; index < targetDifferences.length; index += 1) {
      sum += targetDifferences[source.nextInt(targetDifferences.length)];
    }
    return sum / targetDifferences.length;
  }).sort((left, right) => left - right);

  return {
    lower: percentile(bootstrapMeans, 0.025),
    upper: percentile(bootstrapMeans, 0.975),
    confidenceLevel: 0.95,
    resamples: BACKTEST_BOOTSTRAP_RESAMPLES,
  };
}

export function conclusionForInterval(interval: Pick<BootstrapInterval, 'lower' | 'upper'>): string {
  if (interval.lower <= 0 && interval.upper >= 0) {
    return '무작위 대비 우위 확인 안 됨';
  }
  if (interval.lower > 0) {
    return '평가 표본에서 균형·분산 방식의 평균 일치 수가 높음';
  }
  return '평가 표본에서 균형·분산 방식의 평균 일치 수가 낮음';
}

export function runBacktest(
  draws: readonly Draw[],
  config: BacktestConfig = DEFAULT_BACKTEST_CONFIG,
): BacktestReport {
  validateConfig(config);
  const slices = createWalkForwardSlices(draws, config.minimumTrainingDraws);
  if (slices.length === 0) {
    throw new RangeError('백테스트 평가 회차가 없습니다.');
  }

  const balancedTotals: MutableModeTotals = {
    distribution: createDistribution(),
    mainMatchTotal: 0,
    bonusMatches: 0,
  };
  const randomTotals: MutableModeTotals = {
    distribution: createDistribution(),
    mainMatchTotal: 0,
    bonusMatches: 0,
  };
  const targetDifferences: number[] = [];
  const gamesPerTarget = config.gamesPerPortfolio * config.portfoliosPerTarget;

  slices.forEach(({ training, target }) => {
    let balancedTargetMainTotal = 0;
    let randomTargetMainTotal = 0;
    const shapeModel = buildShapeModel(training);

    for (let repetition = 0; repetition < config.portfoliosPerTarget; repetition += 1) {
      const balancedSource = new SeededRandomSource(
        mixSeed(config.seed, MODE_SEED_TAGS.balanced, target.drawNo, repetition),
      );
      const randomSource = new SeededRandomSource(
        mixSeed(config.seed, MODE_SEED_TAGS.random, target.drawNo, repetition),
      );
      const balanced = generateBalancedPortfolioFromModel(
        config.gamesPerPortfolio,
        shapeModel,
        balancedSource,
        { avoidPopular: false },
      );
      const random = generateRandomPortfolio(config.gamesPerPortfolio, randomSource);

      balancedTargetMainTotal += recordPortfolio(balanced, target, balancedTotals);
      randomTargetMainTotal += recordPortfolio(random, target, randomTotals);
    }

    targetDifferences.push(
      (balancedTargetMainTotal - randomTargetMainTotal) / gamesPerTarget,
    );
  });

  const totalGamesPerMode = slices.length * gamesPerTarget;
  const metrics = {
    balanced: summarizeMode(balancedTotals, totalGamesPerMode),
    random: summarizeMode(randomTotals, totalGamesPerMode),
  };
  const interval = bootstrapMeanDifferenceInterval(
    targetDifferences,
    config.seed,
    BACKTEST_BOOTSTRAP_RESAMPLES,
  );

  return {
    schemaVersion: 1,
    latestDraw: draws.at(-1)!.drawNo,
    config: { ...config },
    evaluation: {
      targetCount: slices.length,
      gamesPerPortfolio: config.gamesPerPortfolio,
      portfoliosPerTarget: config.portfoliosPerTarget,
      totalGamesPerMode,
    },
    metrics,
    meanMainMatchDifference: metrics.balanced.meanMainMatches - metrics.random.meanMainMatches,
    interval,
    conclusion: conclusionForInterval(interval),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseModeMetrics(
  value: unknown,
  totalGamesPerMode: number,
  name: string,
): ModeBacktestMetrics {
  if (!isRecord(value)
    || !Array.isArray(value.mainMatchDistribution)
    || value.mainMatchDistribution.length !== 7
    || value.mainMatchDistribution.some((count) => !Number.isInteger(count) || count < 0)
    || value.mainMatchDistribution.reduce((sum, count) => sum + count, 0) !== totalGamesPerMode
    || !isFiniteNumber(value.meanMainMatches)
    || !Number.isInteger(value.bonusMatches)
    || (value.bonusMatches as number) < 0
    || (value.bonusMatches as number) > totalGamesPerMode
    || !isRecord(value.matchCounts)) {
    throw new Error(`${name} 백테스트 지표가 올바르지 않습니다.`);
  }

  const distribution = value.mainMatchDistribution as MainMatchDistribution;
  const calculatedMean = distribution.reduce((sum, count, matches) => sum + count * matches, 0)
    / totalGamesPerMode;
  if (Math.abs(calculatedMean - value.meanMainMatches) > Number.EPSILON * 16
    || value.matchCounts['3'] !== distribution[3]
    || value.matchCounts['4'] !== distribution[4]
    || value.matchCounts['5'] !== distribution[5]
    || value.matchCounts['6'] !== distribution[6]) {
    throw new Error(`${name} 백테스트 집계가 일치하지 않습니다.`);
  }

  return value as unknown as ModeBacktestMetrics;
}

export function parseBacktestReport(raw: unknown): BacktestReport {
  if (!isRecord(raw)
    || raw.schemaVersion !== 1
    || !Number.isInteger(raw.latestDraw)
    || (raw.latestDraw as number) <= 0
    || !isRecord(raw.config)
    || !isRecord(raw.evaluation)
    || !isRecord(raw.metrics)
    || !isRecord(raw.interval)) {
    throw new Error('백테스트 보고서 형식이 올바르지 않습니다.');
  }

  const config = raw.config as unknown as BacktestConfig;
  validateConfig(config);
  const targetCount = raw.evaluation.targetCount;
  const totalGamesPerMode = raw.evaluation.totalGamesPerMode;
  if (!Number.isInteger(targetCount)
    || (targetCount as number) <= 0
    || raw.evaluation.gamesPerPortfolio !== config.gamesPerPortfolio
    || raw.evaluation.portfoliosPerTarget !== config.portfoliosPerTarget
    || !Number.isInteger(totalGamesPerMode)
    || totalGamesPerMode !== (targetCount as number) * config.gamesPerPortfolio * config.portfoliosPerTarget) {
    throw new Error('백테스트 평가 조건이 올바르지 않습니다.');
  }

  const balanced = parseModeMetrics(raw.metrics.balanced, totalGamesPerMode as number, '균형');
  const random = parseModeMetrics(raw.metrics.random, totalGamesPerMode as number, '무작위');
  const interval = raw.interval;
  if (!isFiniteNumber(interval.lower)
    || !isFiniteNumber(interval.upper)
    || interval.lower > interval.upper
    || interval.confidenceLevel !== 0.95
    || interval.resamples !== BACKTEST_BOOTSTRAP_RESAMPLES
    || !isFiniteNumber(raw.meanMainMatchDifference)) {
    throw new Error('백테스트 불확실성 구간이 올바르지 않습니다.');
  }

  const calculatedDifference = balanced.meanMainMatches - random.meanMainMatches;
  if (Math.abs(calculatedDifference - raw.meanMainMatchDifference) > Number.EPSILON * 16
    || raw.conclusion !== conclusionForInterval(interval as unknown as BootstrapInterval)) {
    throw new Error('백테스트 결론이 집계와 일치하지 않습니다.');
  }

  return raw as unknown as BacktestReport;
}
