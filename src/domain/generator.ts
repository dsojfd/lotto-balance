import { extractShape } from './analysis';
import type { Shape } from './analysis';
import type { Combination, Draw } from './draw';
import { combinationKey } from './draw';
import type { RandomSource } from './random';

const SHAPE_FIELDS: readonly (keyof Shape)[] = [
  'oddCount',
  'lowCount',
  'sum',
  'range',
  'sectionCount',
  'adjacentPairs',
  'duplicateEndings',
];

export type ShapeModel = Record<keyof Shape, Record<string, number>>;

export interface BalancedOptions {
  avoidPopular: boolean;
}

export function drawUniformCombination(source: RandomSource): Combination {
  const numbers = Array.from({ length: 45 }, (_, index) => index + 1);

  for (let index = 0; index < 6; index += 1) {
    const swapIndex = index + source.nextInt(45 - index);
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }

  return numbers.slice(0, 6).sort((a, b) => a - b) as unknown as Combination;
}

export function generateRandomPortfolio(
  count: 1 | 5 | 10,
  source: RandomSource,
): Combination[] {
  const portfolio: Combination[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 100;

  for (let attempts = 0; attempts < maxAttempts && portfolio.length < count; attempts += 1) {
    const combination = drawUniformCombination(source);
    const key = combinationKey(combination);
    if (seen.has(key)) continue;

    seen.add(key);
    portfolio.push(combination);
  }

  if (portfolio.length < count) throw new Error('고유한 추천번호를 생성하지 못했습니다.');

  return portfolio;
}

export function buildShapeModel(draws: readonly Draw[]): ShapeModel {
  const model = Object.fromEntries(
    SHAPE_FIELDS.map((field) => [field, {}]),
  ) as ShapeModel;

  draws.forEach((draw) => {
    const shape = extractShape(draw.numbers);
    SHAPE_FIELDS.forEach((field) => {
      const bucket = String(shape[field]);
      model[field][bucket] = (model[field][bucket] ?? 0) + 1;
    });
  });

  return model;
}

function hasSixConsecutiveNumbers(numbers: Combination): boolean {
  return numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1);
}

function hasRepeatedEnding(numbers: Combination): boolean {
  const endingCounts = new Map<number, number>();
  numbers.forEach((number) => {
    const ending = number % 10;
    endingCounts.set(ending, (endingCounts.get(ending) ?? 0) + 1);
  });
  return [...endingCounts.values()].some((count) => count >= 3);
}

export function scoreCombination(
  numbers: Combination,
  model: ShapeModel,
  avoidPopular: boolean,
): number {
  const shape = extractShape(numbers);
  const fieldScores = SHAPE_FIELDS.map((field) => {
    const histogram = model[field];
    const largestBucketCount = Math.max(0, ...Object.values(histogram));
    if (largestBucketCount === 0) return 0;
    return (histogram[String(shape[field])] ?? 0) / largestBucketCount;
  });

  let score = fieldScores.reduce((total, fieldScore) => total + fieldScore, 0)
    / SHAPE_FIELDS.length;

  if (!avoidPopular) return score;

  // These cumulative heuristics only alter portfolio composition. They do not
  // increase or estimate the winning probability of any selected combination.
  if (numbers.every((number) => number <= 31)) score *= 0.8;
  if (hasSixConsecutiveNumbers(numbers)) score *= 0.7;
  if (hasRepeatedEnding(numbers)) score *= 0.9;
  return score;
}

function overlap(left: Combination, right: Combination): number {
  const rightNumbers = new Set(right);
  return left.filter((number) => rightNumbers.has(number)).length;
}

export function selectDiverseCandidates(
  candidates: readonly Combination[],
  count: number,
  shapeScoreFor: (candidate: Combination) => number,
): Combination[] {
  if (!Number.isInteger(count) || count < 0 || count > candidates.length) {
    throw new RangeError('선택할 추천번호 수가 후보 범위를 벗어났습니다.');
  }

  const remaining = [...candidates];
  const selected: Combination[] = [];
  const shapeScores = new Map(
    candidates.map((candidate) => [combinationKey(candidate), shapeScoreFor(candidate)]),
  );

  while (selected.length < count) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestKey = '';

    remaining.forEach((candidate, index) => {
      const key = combinationKey(candidate);
      const shapeScore = shapeScores.get(key)!;
      const diversityScore = selected.length === 0
        ? 0
        : 1 - Math.max(...selected.map((line) => overlap(candidate, line))) / 6;
      const finalScore = selected.length === 0
        ? shapeScore
        : 0.7 * shapeScore + 0.3 * diversityScore;

      if (finalScore > bestScore || (finalScore === bestScore && (bestIndex === -1 || key < bestKey))) {
        bestIndex = index;
        bestScore = finalScore;
        bestKey = key;
      }
    });

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

export function generateBalancedPortfolio(
  count: 1 | 5 | 10,
  draws: readonly Draw[],
  source: RandomSource,
  options: BalancedOptions,
): Combination[] {
  return generateBalancedPortfolioFromModel(count, buildShapeModel(draws), source, options);
}

export function generateBalancedPortfolioFromModel(
  count: 1 | 5 | 10,
  model: ShapeModel,
  source: RandomSource,
  options: BalancedOptions,
): Combination[] {
  const candidateCount = Math.max(2500, count * 500);
  const maxAttempts = candidateCount * 100;
  const candidates: Combination[] = [];
  const seen = new Set<string>();

  for (let attempts = 0; attempts < maxAttempts && candidates.length < candidateCount; attempts += 1) {
    const candidate = drawUniformCombination(source);
    const key = combinationKey(candidate);
    if (seen.has(key)) continue;

    seen.add(key);
    candidates.push(candidate);
  }

  if (candidates.length < candidateCount) {
    throw new Error('고유한 추천번호를 생성하지 못했습니다.');
  }

  return selectDiverseCandidates(
    candidates,
    count,
    (candidate) => scoreCombination(candidate, model, options.avoidPopular),
  );
}
