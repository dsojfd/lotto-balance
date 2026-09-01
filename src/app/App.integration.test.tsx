import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { AppDataState } from '../data/appData';
import { App } from './App';

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
  analysis: {} as AppDataState['analysis'],
  backtest: {} as AppDataState['backtest'],
  isOfflineFallback: true,
};

it('shows the data status, offline banner, recommendation shell, and four tabs', async () => {
  render(<App loadData={() => Promise.resolve(appData)} />);

  expect(await screen.findByText('제1201회 기준 · 갱신 2026. 8. 30.')).toBeVisible();
  expect(screen.getByText('오프라인 저장 데이터로 표시 중입니다.')).toBeVisible();
  for (const name of ['추천', '분석', '검증', '저장']) {
    expect(screen.getByRole('button', { name })).toBeVisible();
  }
  expect(screen.getByRole('button', { name: '추천' })).toHaveAttribute('aria-pressed', 'true');
});

it('shows a Korean fatal-data message when data loading fails', async () => {
  render(<App loadData={() => Promise.reject(new Error('failed'))} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('로또 데이터를 불러오지 못했습니다.');
});
