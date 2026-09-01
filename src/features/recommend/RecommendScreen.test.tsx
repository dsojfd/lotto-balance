import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { SavedPortfolioStore } from '../../data/savedPortfolios';
import type { DrawDataset } from '../../domain/draw';
import { SeededRandomSource, type RandomSource } from '../../domain/random';
import { RecommendScreen } from './RecommendScreen';

const validDataset: DrawDataset = {
  schemaVersion: 1,
  generatedAt: '2026-08-30T12:00:00.000Z',
  latestDraw: 1201,
  sourceUrl: 'https://www.dhlottery.co.kr/lt645/result',
  draws: [
    { drawNo: 1, drawDate: '2002-12-07', numbers: [3, 5, 12, 20, 27, 35], bonus: 41 },
    { drawNo: 2, drawDate: '2002-12-14', numbers: [1, 9, 18, 23, 34, 42], bonus: 7 },
  ],
};

function renderedCards(): HTMLElement[] {
  return screen.getAllByRole('listitem', { name: /추천 조합/ });
}

beforeEach(() => window.localStorage.clear());

it('defaults to five balanced games and generates five distinct sorted cards', async () => {
  const user = userEvent.setup();
  const source = new SeededRandomSource(42);
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => source} />);

  expect(screen.getByRole('button', { name: '5게임' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '균형·분산 추천' })).toHaveAttribute('aria-pressed', 'true');

  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));

  const cards = renderedCards();
  expect(cards).toHaveLength(5);
  expect(new Set(cards.map((card) => card.textContent)).size).toBe(5);
  cards.forEach((card) => {
    expect(card).toHaveTextContent(/홀짝\s*\d+홀 \d+짝/);
    expect(card).toHaveTextContent(/합계\s*\d+/);
    expect(card).toHaveTextContent(/연속 번호\s*\d+쌍/);
    expect(card).toHaveTextContent(/조합 형태 점수/);
    expect(card.querySelectorAll('[aria-label^="번호 "]')).toHaveLength(6);
  });
});

it.each([1, 10] as const)('generates the selected %i-game portfolio', async (gameCount) => {
  const user = userEvent.setup();
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => new SeededRandomSource(100 + gameCount)} />);

  await user.click(screen.getByRole('button', { name: `${gameCount}게임` }));
  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));

  expect(renderedCards()).toHaveLength(gameCount);
});

it('uses random mode when selected', async () => {
  const user = userEvent.setup();
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => new SeededRandomSource(8)} />);

  await user.click(screen.getByRole('button', { name: '무작위 추천' }));
  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));

  expect(screen.getByText('무작위 추천 결과')).toBeVisible();
  expect(renderedCards()).toHaveLength(5);
});

it('regenerates a changed portfolio with a continuing injected random source', async () => {
  const user = userEvent.setup();
  const source = new SeededRandomSource(17);
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => source} />);

  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));
  const firstPortfolio = renderedCards().map((card) => card.textContent).join('|');
  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));

  expect(renderedCards().map((card) => card.textContent).join('|')).not.toBe(firstPortfolio);
});

it('shows the next draw, exact disclosure, and saves every generated line as one portfolio', async () => {
  const user = userEvent.setup();
  const store = new SavedPortfolioStore(window.localStorage);
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => new SeededRandomSource(23)} savedPortfolioStore={store} />);

  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));
  expect(screen.getByText('제1202회 추천')).toBeVisible();
  expect(screen.getByText('모든 고정 조합의 1등 확률은 동일합니다 (1/8,145,060)')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '전체 저장' }));

  const saved = store.list();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ targetDrawNo: 1202, mode: 'balanced' });
  expect(saved[0].combinations).toHaveLength(5);
  expect(screen.getByText('추천 조합을 저장했습니다.')).toBeVisible();
});

it('keeps generated cards visible and shows a Korean error when saving fails', async () => {
  const user = userEvent.setup();
  const failingStore = { save: () => { throw new Error('quota'); } } as Pick<SavedPortfolioStore, 'save'>;
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => new SeededRandomSource(91)} savedPortfolioStore={failingStore} />);

  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));
  await user.click(screen.getByRole('button', { name: '전체 저장' }));

  expect(renderedCards()).toHaveLength(5);
  expect(screen.getByRole('alert')).toHaveTextContent('추천 조합을 저장하지 못했습니다.');
});

it('shows a Korean error when secure random generation is unavailable', async () => {
  const user = userEvent.setup();
  const failingSource: RandomSource = { nextInt: () => { throw new Error('안전한 난수를 사용할 수 없습니다.'); } };
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => failingSource} />);

  await user.click(screen.getByRole('button', { name: '무작위 추천' }));
  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));

  expect(screen.getByRole('alert')).toHaveTextContent('안전한 난수를 사용할 수 없습니다.');
});
