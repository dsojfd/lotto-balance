import type { Combination } from './draw';
import { combinationKey } from './draw';
import type { RandomSource } from './random';

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
