import type { Combination, Draw } from './draw';

export interface CheckedResult {
  mainMatches: number;
  bonusMatched: boolean;
  rank: 1 | 2 | 3 | 4 | 5 | null;
}

export function checkCombination(numbers: Combination, draw: Draw): CheckedResult {
  const winningNumbers = new Set(draw.numbers);
  const mainMatches = numbers.filter((number) => winningNumbers.has(number)).length;
  const bonusMatched = numbers.includes(draw.bonus);
  const rank = mainMatches === 6 ? 1
    : mainMatches === 5 && bonusMatched ? 2
      : mainMatches === 5 ? 3
        : mainMatches === 4 ? 4
          : mainMatches === 3 ? 5
            : null;
  return { mainMatches, bonusMatched, rank };
}
