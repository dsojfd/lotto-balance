import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';

it('renders the Korean product name and four primary tabs', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '로또 밸런스' })).toBeVisible();
  for (const name of ['추천', '분석', '예상게임', '저장']) {
    expect(screen.getByRole('tab', { name })).toBeVisible();
  }
});
