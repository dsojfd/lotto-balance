import type { Combination, Draw } from './draw';
import {
  buildShapeModel,
  drawUniformCombination,
  generateBalancedPortfolioFromModel,
} from './generator';
import type { RandomSource } from './random';
import { checkCombination } from './rank';

export type SimulationGameCount = 10 | 20 | 30 | 50 | 100;
export type SimulationMode = 'balanced' | 'random';

export interface VirtualResult {
  numbers: Combination;
  bonus: number;
}

export interface SimulationSummary {
  rankCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  losingCount: number;
  highestRank: 1 | 2 | 3 | 4 | 5 | null;
}

export type YieldControl = () => Promise<void>;

function addUniqueGames(
  target: Combination[],
  seen: Set<string>,
  games: readonly Combination[],
  count: SimulationGameCount,
): void {
  games.forEach((game) => {
    if (target.length >= count) return;
    const key = game.join('-');
    if (seen.has(key)) return;
    seen.add(key);
    target.push(game);
  });
}

export function drawVirtualResult(source: RandomSource): VirtualResult {
  const numbers = drawUniformCombination(source);
  const remaining = Array.from({ length: 45 }, (_, index) => index + 1)
    .filter((number) => !numbers.includes(number));
  return { numbers, bonus: remaining[source.nextInt(remaining.length)] };
}

export function generateSimulationPortfolio(
  count: SimulationGameCount,
  mode: SimulationMode,
  draws: readonly Draw[],
  source: RandomSource,
): Combination[] {
  const portfolio: Combination[] = [];
  const seen = new Set<string>();

  if (mode === 'random') {
    const maxAttempts = count * 100;
    for (let attempts = 0; attempts < maxAttempts && portfolio.length < count; attempts += 1) {
      const game = drawUniformCombination(source);
      const key = game.join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      portfolio.push(game);
    }
  } else {
    const model = buildShapeModel(draws);
    const maxBatches = count * 10;
    for (let batch = 0; batch < maxBatches && portfolio.length < count; batch += 1) {
      const games = generateBalancedPortfolioFromModel(10, model, source, { avoidPopular: false });
      addUniqueGames(portfolio, seen, games, count);
    }
  }

  if (portfolio.length < count) throw new Error('고유한 예상게임 번호를 생성하지 못했습니다.');
  return portfolio;
}

export async function generateSimulationPortfolioAsync(
  count: SimulationGameCount,
  mode: SimulationMode,
  draws: readonly Draw[],
  source: RandomSource,
  yieldControl: YieldControl,
): Promise<Combination[]> {
  await yieldControl();
  if (mode === 'random') return generateSimulationPortfolio(count, mode, draws, source);

  const portfolio: Combination[] = [];
  const seen = new Set<string>();
  const model = buildShapeModel(draws);
  const maxBatches = count * 10;

  for (let batch = 0; batch < maxBatches && portfolio.length < count; batch += 1) {
    if (batch > 0) await yieldControl();
    const games = generateBalancedPortfolioFromModel(10, model, source, { avoidPopular: false });
    addUniqueGames(portfolio, seen, games, count);
  }

  if (portfolio.length < count) throw new Error('고유한 예상게임 번호를 생성하지 못했습니다.');
  return portfolio;
}

export function summarizeSimulation(
  games: readonly Combination[],
  draw: VirtualResult,
): SimulationSummary {
  const rankCounts: SimulationSummary['rankCounts'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const resultDraw: Draw = { drawNo: 0, drawDate: '', ...draw };
  let losingCount = 0;

  games.forEach((game) => {
    const result = checkCombination(game, resultDraw);
    if (result.rank === null) losingCount += 1;
    else rankCounts[result.rank] += 1;
  });

  const highestRank = ([1, 2, 3, 4, 5] as const).find((rank) => rankCounts[rank] > 0) ?? null;
  return { rankCounts, losingCount, highestRank };
}
