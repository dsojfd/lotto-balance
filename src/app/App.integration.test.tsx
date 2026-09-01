import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import type { AnalysisFileReport, AppDataState, BacktestFileReport } from '../data/appData';
import { SavedPortfolioStore } from '../data/savedPortfolios';
import type { AnalysisWindow } from '../domain/analysis';
import { App } from './App';

const analysisWindow: AnalysisWindow = {
  drawCount: 2,
  numbers: Array.from({ length: 45 }, (_, index) => ({ number: index + 1, appearances: 0, expected: 2 / 15, delta: -2 / 15, absence: 2 })),
  shapeHistograms: { oddCount: { '3': 2 }, lowCount: { '2': 2 }, sum: { '130': 2 }, range: { '31': 2 }, sectionCount: { '4': 2 }, adjacentPairs: { '0': 2 }, duplicateEndings: { '1': 2 } },
  fixedSectionCounts: { '1-10': { '1': 2 }, '11-20': { '1': 2 }, '21-30': { '2': 2 }, '31-40': { '1': 2 }, '41-45': { '1': 2 } },
  pairCounts: { '1-2': 1 }, pairSampleSize: 2, previousDrawReuse: { '0': 1 }, previousDrawReuseSampleSize: 1,
};

const analysis: AnalysisFileReport = {
  schemaVersion: 1, latestDraw: 1201, generatedAt: '2026-08-30T12:00:00.000Z',
  metrics: { windows: { all: analysisWindow, '10': analysisWindow, '30': analysisWindow, '50': analysisWindow, '100': analysisWindow } },
};

const backtest: BacktestFileReport = {
  schemaVersion: 1, latestDraw: 1201, generatedAt: '2026-08-30T12:00:00.000Z',
  config: { minimumTrainingDraws: 1200, gamesPerPortfolio: 5, portfoliosPerTarget: 20, seed: 1 },
  evaluation: { targetCount: 1, gamesPerPortfolio: 5, portfoliosPerTarget: 20, totalGamesPerMode: 100 },
  metrics: { balanced: { mainMatchDistribution: [100, 0, 0, 0, 0, 0, 0], meanMainMatches: 0, matchCounts: { '3': 0, '4': 0, '5': 0, '6': 0 }, bonusMatches: 0 }, random: { mainMatchDistribution: [100, 0, 0, 0, 0, 0, 0], meanMainMatches: 0, matchCounts: { '3': 0, '4': 0, '5': 0, '6': 0 }, bonusMatches: 0 } },
  meanMainMatchDifference: 0, interval: { lower: 0, upper: 0, confidenceLevel: 0.95, resamples: 2000 }, conclusion: '무작위 대비 우위 확인 안 됨',
};

const appData: AppDataState = {
  dataset: {
    schemaVersion: 1,
    generatedAt: '2026-08-30T12:00:00.000Z',
    latestDraw: 1201,
    sourceUrl: 'https://www.dhlottery.co.kr/lt645/result',
    draws: [
      { drawNo: 1, drawDate: '2002-12-07', numbers: [3, 5, 12, 20, 27, 35], bonus: 41 },
      { drawNo: 2, drawDate: '2002-12-14', numbers: [1, 9, 18, 23, 34, 42], bonus: 7 },
    ],
  },
  analysis,
  backtest,
  isOfflineFallback: true,
};

it('shows the data status, offline banner, recommendation shell, and four tabs', async () => {
  render(<App loadData={() => Promise.resolve(appData)} />);

  expect(await screen.findByText('제1201회 기준 · 갱신 2026. 8. 30.')).toBeVisible();
  expect(screen.getByText('오프라인 저장 데이터로 표시 중입니다.')).toBeVisible();
  for (const name of ['추천', '분석', '검증', '저장']) {
    expect(screen.getByRole('tab', { name })).toBeVisible();
  }
  expect(screen.getByRole('tab', { name: '추천' })).toHaveAttribute('aria-selected', 'true');
});

it('shows a Korean fatal-data message when data loading fails', async () => {
  render(<App loadData={() => Promise.reject(new Error('failed'))} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('로또 데이터를 불러오지 못했습니다.');
});

it('switches from recommendation to analysis and verification tabs with tab semantics', async () => {
  const user = userEvent.setup();
  render(<App loadData={() => Promise.resolve(appData)} />);

  await user.click(await screen.findByRole('tab', { name: '분석' }));
  expect(screen.getByRole('tab', { name: '분석' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: '분석' })).toBeVisible();

  await user.click(screen.getByRole('tab', { name: '검증' }));
  expect(screen.getByRole('tab', { name: '검증' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: '검증' })).toBeVisible();

  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: '저장' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: '저장' })).toHaveAttribute('aria-selected', 'true');
});

it('reads the latest device records each time the saved tab is opened', async () => {
  const user = userEvent.setup();
  localStorage.clear();
  const store = new SavedPortfolioStore(localStorage);
  render(<App loadData={() => Promise.resolve(appData)} savedPortfolioStore={store} />);

  await user.click(await screen.findByRole('tab', { name: '저장' }));
  expect(screen.getByText('저장된 조합이 없습니다.')).toBeVisible();

  await user.click(screen.getByRole('tab', { name: '추천' }));
  store.save({
    id: 'newly-saved',
    schemaVersion: 1,
    targetDrawNo: 1202,
    mode: 'balanced',
    createdAt: '2026-08-30T13:00:00.000Z',
    combinations: [[1, 8, 17, 28, 34, 45]],
  });
  await user.click(screen.getByRole('tab', { name: '저장' }));

  expect(screen.getByRole('article', { name: 'newly-saved 저장 기록' })).toBeVisible();
  expect(screen.getByText('추첨 전')).toBeVisible();
});
