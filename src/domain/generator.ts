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

  while (portfolio.length < count) {
    const combination = drawUniformCombination(source);
    const key = combinationKey(combination);
    if (seen.has(key)) continue;

    seen.add(key);
    portfolio.push(combination);
  }

  return portfolio;
}
