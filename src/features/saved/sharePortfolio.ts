import type { SavedPortfolio } from '../../data/savedPortfolios';

export type ShareablePortfolio = Pick<
  SavedPortfolio,
  'targetDrawNo' | 'mode' | 'createdAt' | 'combinations'
>;

export interface ShareDependencies {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: Pick<Clipboard, 'writeText'>;
}

export type SharePortfolioResult = 'shared' | 'copied';

function modeLabel(mode: ShareablePortfolio['mode']): string {
  return mode === 'balanced' ? '균형·분산 추천' : '무작위 추천';
}

export function buildPortfolioShareText(portfolio: ShareablePortfolio): string {
  return [
    '로또 밸런스',
    `대상 회차: 제${portfolio.targetDrawNo}회`,
    `생성 방식: ${modeLabel(portfolio.mode)}`,
    `생성 시각: ${portfolio.createdAt}`,
    '',
    ...portfolio.combinations.map((combination, index) => `${index + 1}. ${combination.join(', ')}`),
  ].join('\n');
}

export async function copyPortfolio(
  portfolio: ShareablePortfolio,
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
): Promise<void> {
  if (!clipboard) throw new Error('클립보드를 사용할 수 없습니다.');
  await clipboard.writeText(buildPortfolioShareText(portfolio));
}

export async function sharePortfolio(
  portfolio: ShareablePortfolio,
  dependencies: ShareDependencies,
): Promise<SharePortfolioResult> {
  const text = buildPortfolioShareText(portfolio);
  if (dependencies.share) {
    await dependencies.share({ title: `로또 밸런스 제${portfolio.targetDrawNo}회`, text });
    return 'shared';
  }
  await copyPortfolio(portfolio, dependencies.clipboard);
  return 'copied';
}
