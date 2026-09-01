import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import type { AnalysisReport, AnalysisWindow } from '../../domain/analysis';
import { AnalysisScreen } from './AnalysisScreen';

function windowWith(drawCount: number): AnalysisWindow {
  return {
    drawCount,
    numbers: Array.from({ length: 45 }, (_, index) => ({
      number: index + 1,
      appearances: index === 0 ? 3 : 0,
      expected: 2,
      delta: index === 0 ? 1 : -2,
      absence: index === 0 ? 2 : drawCount,
    })),
    shapeHistograms: {
      oddCount: { '3': drawCount }, lowCount: { '2': drawCount }, sum: { '130': drawCount },
      range: { '31': drawCount }, sectionCount: { '4': drawCount }, adjacentPairs: { '1': drawCount },
      duplicateEndings: { '2': drawCount },
    },
    fixedSectionCounts: {
      '1-10': { '1': drawCount }, '11-20': { '1': drawCount }, '21-30': { '2': drawCount },
      '31-40': { '1': drawCount }, '41-45': { '1': drawCount },
    },
    pairCounts: { '1-2': 4, '1-3': 2 },
    pairSampleSize: drawCount,
    previousDrawReuse: { '0': Math.max(0, drawCount - 1) },
    previousDrawReuseSampleSize: Math.max(0, drawCount - 1),
  };
}

const report: AnalysisReport = {
  windows: {
    all: windowWith(12), '10': windowWith(10), '30': windowWith(12), '50': windowWith(12), '100': windowWith(12),
  },
};

it('changes the displayed available draw count for every analysis window', async () => {
  const user = userEvent.setup();
  render(<AnalysisScreen report={report} />);

  expect(screen.getByText('집계 회차 12회')).toBeVisible();
  for (const label of ['최근 10회', '최근 30회', '최근 50회', '최근 100회']) {
    await user.click(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
  }
  expect(screen.getByText('집계 회차 12회')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '최근 10회' }));
  expect(screen.getByText('집계 회차 10회')).toBeVisible();
});

it('shows frequency, absence, pair sample size, fixed metrics, and a non-predictive disclaimer', async () => {
  const user = userEvent.setup();
  render(<AnalysisScreen report={report} />);

  expect(screen.getByText('1번')).toBeVisible();
  expect(screen.getByText('출현 3회')).toBeVisible();
  expect(screen.getByText('미출현 2회')).toBeVisible();
  expect(screen.getByText('번호쌍 (표본 12회)')).toBeVisible();
  await user.click(screen.getByText('번호쌍 (표본 12회)'));
  expect(screen.getByText('1-2 · 4회')).toBeVisible();
  expect(screen.getByText('홀수 개수 (표본 12회)')).toBeVisible();
  expect(screen.getByText('1-10 구간 개수 (표본 12회)')).toBeVisible();
  expect(screen.getByText('이전 회차 재출현 (표본 11회)')).toBeVisible();
  expect(screen.getByText('다음 회차 당첨확률 예측이 아닙니다')).toBeVisible();
});
