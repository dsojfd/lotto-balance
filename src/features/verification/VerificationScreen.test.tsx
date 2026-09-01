import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { BacktestReport } from '../../domain/backtest';
import { VerificationScreen } from './VerificationScreen';

const reportIncludingZero: BacktestReport = {
  schemaVersion: 1,
  latestDraw: 120,
  config: { minimumTrainingDraws: 100, gamesPerPortfolio: 5, portfoliosPerTarget: 20, seed: 12345 },
  evaluation: { targetCount: 20, gamesPerPortfolio: 5, portfoliosPerTarget: 20, totalGamesPerMode: 2000 },
  metrics: {
    balanced: { mainMatchDistribution: [900, 700, 300, 80, 18, 2, 0], meanMainMatches: 0.76, matchCounts: { '3': 80, '4': 18, '5': 2, '6': 0 }, bonusMatches: 250 },
    random: { mainMatchDistribution: [920, 690, 300, 70, 18, 2, 0], meanMainMatches: 0.74, matchCounts: { '3': 70, '4': 18, '5': 2, '6': 0 }, bonusMatches: 240 },
  },
  meanMainMatchDifference: 0.02,
  interval: { lower: -0.03, upper: 0.06, confidenceLevel: 0.95, resamples: 2000 },
  conclusion: '무작위 대비 우위 확인 안 됨',
};

it('shows inputs, distributions, uncertainty, and the report conclusion without recomputing it', () => {
  render(<VerificationScreen report={reportIncludingZero} />);

  expect(screen.getByText('평가 대상 20회')).toBeVisible();
  expect(screen.getByText('게임 수 5')).toBeVisible();
  expect(screen.getByText('반복 수 20')).toBeVisible();
  expect(screen.getByText('시드 12345')).toBeVisible();
  expect(screen.getByText('0개 일치 900')).toBeVisible();
  expect(screen.getAllByText('6개 일치 0')).toHaveLength(2);
  expect(screen.getByText('3개 80 · 4개 18 · 5개 2 · 6개 0')).toBeVisible();
  expect(screen.getByText(/95% 구간.*-0\.03.*0\.06/)).toBeVisible();
  expect(screen.getByText('무작위 대비 우위 확인 안 됨')).toBeVisible();
  expect(screen.getByText(/시드 난수는 보고서 재현용/)).toBeVisible();
});

it('connects each comparison region to a fixed whitespace-free heading id', () => {
  render(<VerificationScreen report={reportIncludingZero} />);

  const balancedHeading = screen.getByRole('heading', { name: '균형·분산 방식' });
  const randomHeading = screen.getByRole('heading', { name: '무작위 방식' });
  expect(balancedHeading).toHaveAttribute('id', 'verification-mode-balanced-heading');
  expect(randomHeading).toHaveAttribute('id', 'verification-mode-random-heading');
  for (const heading of [balancedHeading, randomHeading]) {
    expect(heading.id).not.toMatch(/\s/);
    expect(heading.closest('section')).toHaveAttribute('aria-labelledby', heading.id);
  }
});
