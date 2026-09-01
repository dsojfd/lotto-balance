import { describe, expect, it, vi } from 'vitest';
import type { SavedPortfolio } from '../../data/savedPortfolios';
import { buildPortfolioShareText, copyPortfolio, sharePortfolio } from './sharePortfolio';

const savedPortfolio: SavedPortfolio = {
  id: 'saved-1202',
  schemaVersion: 1,
  targetDrawNo: 1202,
  mode: 'balanced',
  createdAt: '2026-08-30T12:34:56.000Z',
  combinations: [
    [1, 8, 17, 28, 34, 45],
    [2, 9, 18, 29, 35, 44],
    [3, 10, 19, 30, 36, 43],
    [4, 11, 20, 31, 37, 42],
    [5, 12, 21, 32, 38, 41],
  ],
};

describe('portfolio sharing', () => {
  it('builds Korean text with target draw, mode, creation time, and every combination', () => {
    const text = buildPortfolioShareText(savedPortfolio);

    expect(text).toContain('로또 밸런스');
    expect(text).toContain('제1202회');
    expect(text).toContain('균형·분산 추천');
    expect(text).toContain('2026');
    savedPortfolio.combinations.forEach((combination, index) => {
      expect(text).toContain(`${index + 1}. ${combination.join(', ')}`);
    });
  });

  it('uses Web Share when it is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    await expect(sharePortfolio(savedPortfolio, { share, clipboard })).resolves.toBe('shared');

    expect(share).toHaveBeenCalledWith({
      title: '로또 밸런스 제1202회',
      text: expect.stringContaining('1. 1, 8, 17, 28, 34, 45'),
    });
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('uses clipboard only when Web Share is unavailable', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    await expect(sharePortfolio(savedPortfolio, { share: undefined, clipboard })).resolves.toBe('copied');

    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('로또 밸런스'));
  });

  it('does not fall back to clipboard when Web Share fails', async () => {
    const share = vi.fn().mockRejectedValue(new Error('share failed'));
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    await expect(sharePortfolio(savedPortfolio, { share, clipboard })).rejects.toThrow('share failed');
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('supports explicit copying and surfaces clipboard failures', async () => {
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('copy denied')) };

    await expect(copyPortfolio(savedPortfolio, clipboard)).rejects.toThrow('copy denied');
  });
});
