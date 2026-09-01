import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_DATA_CACHE_KEYS } from '../../data/appData';
import {
  SAVED_PORTFOLIOS_KEY,
  SavedPortfolioStore,
  type SavedPortfolio,
} from '../../data/savedPortfolios';
import type { DrawDataset } from '../../domain/draw';
import { SavedScreen } from './SavedScreen';

const dataset: DrawDataset = {
  schemaVersion: 1,
  generatedAt: '2026-08-30T12:00:00.000Z',
  latestDraw: 1201,
  sourceUrl: 'https://www.dhlottery.co.kr/lt645/result',
  draws: [{
    drawNo: 1201,
    drawDate: '2026-08-30',
    numbers: [1, 2, 3, 4, 5, 6],
    bonus: 7,
  }],
};

const completed: SavedPortfolio = {
  id: 'completed',
  schemaVersion: 1,
  targetDrawNo: 1201,
  mode: 'balanced',
  createdAt: '2026-08-29T03:00:00.000Z',
  combinations: [[1, 2, 3, 4, 5, 6]],
};

const anotherCompleted: SavedPortfolio = {
  id: 'another-completed',
  schemaVersion: 1,
  targetDrawNo: 1201,
  mode: 'random',
  createdAt: '2026-08-28T03:00:00.000Z',
  combinations: [[1, 2, 3, 4, 5, 7]],
};

const future: SavedPortfolio = {
  id: 'future',
  schemaVersion: 1,
  targetDrawNo: 1202,
  mode: 'random',
  createdAt: '2026-08-30T03:00:00.000Z',
  combinations: [[8, 9, 10, 11, 12, 13]],
};

beforeEach(() => {
  localStorage.clear();
});

describe('SavedScreen', () => {
  it('groups the newest target draw first and checks completed combinations', () => {
    const store = new SavedPortfolioStore(localStorage);
    store.save(completed);
    store.save(future);
    store.save(anotherCompleted);

    render(<SavedScreen dataset={dataset} store={store} />);

    const groups = screen.getAllByRole('heading', { level: 3 });
    expect(groups.map((heading) => heading.textContent)).toEqual(['제1202회', '제1201회']);
    expect(screen.getByText('이 기기의 브라우저에만 저장됩니다.')).toBeVisible();
    expect(screen.getByText('추첨 전')).toBeVisible();
    expect(screen.getByText('본번호 6개 · 보너스 불일치 · 1등')).toBeVisible();
    expect(screen.getByText('본번호 5개 · 보너스 일치 · 2등')).toBeVisible();
  });

  it('deletes only the explicitly selected portfolio and preserves public data cache keys', async () => {
    const user = userEvent.setup();
    const store = new SavedPortfolioStore(localStorage);
    store.save(completed);
    store.save(future);
    localStorage.setItem(APP_DATA_CACHE_KEYS.dataset, 'validated-dataset');
    localStorage.setItem(APP_DATA_CACHE_KEYS.analysis, 'validated-analysis');
    localStorage.setItem(APP_DATA_CACHE_KEYS.backtest, 'validated-backtest');

    render(<SavedScreen dataset={dataset} store={store} />);
    await user.click(screen.getByRole('button', { name: 'completed 삭제' }));

    expect(store.list().map(({ id }) => id)).toEqual(['future']);
    expect(screen.queryByRole('button', { name: 'completed 삭제' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'future 삭제' })).toBeVisible();
    expect(localStorage.getItem(APP_DATA_CACHE_KEYS.dataset)).toBe('validated-dataset');
    expect(localStorage.getItem(APP_DATA_CACHE_KEYS.analysis)).toBe('validated-analysis');
    expect(localStorage.getItem(APP_DATA_CACHE_KEYS.backtest)).toBe('validated-backtest');
  });

  it('shows a read error without overwriting corrupt saved bytes', () => {
    const raw = '{corrupt saved bytes';
    localStorage.setItem(SAVED_PORTFOLIOS_KEY, raw);
    localStorage.setItem(APP_DATA_CACHE_KEYS.dataset, 'public-cache');

    render(<SavedScreen dataset={dataset} store={new SavedPortfolioStore(localStorage)} />);

    expect(screen.getByRole('alert')).toHaveTextContent('저장된 조합 데이터를 읽을 수 없습니다.');
    expect(localStorage.getItem(SAVED_PORTFOLIOS_KEY)).toBe(raw);
    expect(localStorage.getItem(APP_DATA_CACHE_KEYS.dataset)).toBe('public-cache');
  });

  it('makes share and copy failures visible without changing the saved record', async () => {
    const user = userEvent.setup();
    const store = new SavedPortfolioStore(localStorage);
    store.save(future);
    const share = vi.fn().mockRejectedValue(new Error('cancelled'));
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) };

    render(<SavedScreen dataset={dataset} store={store} shareDependencies={{ share, clipboard }} />);
    const record = screen.getByRole('article', { name: 'future 저장 기록' });

    await user.click(within(record).getByRole('button', { name: '공유' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('공유하지 못했습니다.');
    expect(clipboard.writeText).not.toHaveBeenCalled();

    await user.click(within(record).getByRole('button', { name: '복사' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('복사하지 못했습니다.');
    expect(store.list()).toEqual([future]);
  });
});
