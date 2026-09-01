import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Draw } from '../../domain/draw';
import { SeededRandomSource } from '../../domain/random';
import { ExpectedGameScreen } from './ExpectedGameScreen';

const history: Draw[] = [
  { drawNo: 1, drawDate: '2002-12-07', numbers: [3, 5, 12, 20, 27, 35], bonus: 41 },
  { drawNo: 2, drawDate: '2002-12-14', numbers: [1, 9, 18, 23, 34, 42], bonus: 7 },
];

describe('ExpectedGameScreen', () => {
  it('shows generated games before revealing the virtual draw', async () => {
    const user = userEvent.setup();
    render(<ExpectedGameScreen draws={history} randomSourceFactory={() => new SeededRandomSource(7)} />);

    expect(screen.getByRole('button', { name: '분석 추천' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '10게임' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '게임번호 생성' }));

    expect(await screen.findAllByRole('listitem', { name: /가상 구매 조합/ })).toHaveLength(10);
    expect(screen.queryByRole('heading', { name: '가상 당첨번호' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추첨 시작' })).toBeVisible();
  });

  it('reveals the winning numbers and rank summary only after drawing', async () => {
    const user = userEvent.setup();
    render(
      <ExpectedGameScreen
        draws={history}
        randomSourceFactory={() => new SeededRandomSource(7)}
        drawRandomSourceFactory={() => new SeededRandomSource(19)}
      />,
    );

    await user.click(screen.getByRole('button', { name: '완전 랜덤' }));
    await user.click(screen.getByRole('button', { name: '게임번호 생성' }));
    await user.click(await screen.findByRole('button', { name: '추첨 시작' }));

    const resultHeading = screen.getByRole('heading', { name: '가상 당첨번호' });
    expect(resultHeading).toBeVisible();
    expect(resultHeading).toHaveFocus();
    expect(screen.getByText('보너스번호', { exact: true })).toBeVisible();
    expect(screen.getByText('당첨 게임 없음')).toBeVisible();
    expect(screen.getByText('1등 0게임')).toBeVisible();
    expect(screen.getByRole('button', { name: '다시 도전' })).toBeVisible();
  });

  it('shows progress while generating one hundred analysis games', async () => {
    const user = userEvent.setup();
    render(<ExpectedGameScreen draws={history} randomSourceFactory={() => new SeededRandomSource(19)} />);

    await user.click(screen.getByRole('button', { name: '100게임' }));
    await user.click(screen.getByRole('button', { name: '게임번호 생성' }));

    expect(screen.getByRole('button', { name: '게임번호 생성 중' })).toBeDisabled();
    expect(await screen.findAllByRole(
      'listitem',
      { name: /가상 구매 조합/ },
      { timeout: 5000 },
    )).toHaveLength(100);
  });
});
