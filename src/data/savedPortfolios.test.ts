import { describe, expect, it } from 'vitest';
import { loadAppData } from './appData';
import type { SavedPortfolio } from './savedPortfolios';
import { SavedPortfolioStore } from './savedPortfolios';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const first: SavedPortfolio = {
  id: 'first',
  schemaVersion: 1,
  targetDrawNo: 1240,
  mode: 'balanced',
  createdAt: '2026-09-01T00:00:00.000Z',
  combinations: [[1, 9, 17, 28, 34, 45]],
};

const second: SavedPortfolio = {
  ...first,
  id: 'second',
  mode: 'random',
  combinations: [[2, 10, 18, 29, 35, 44]],
};

describe('SavedPortfolioStore', () => {
  it('saves one record without changing public data keys', () => {
    const storage = new MemoryStorage();
    storage.setItem('lotto.dataset.v1', 'dataset bytes');
    storage.setItem('lotto.analysis.v1', 'analysis bytes');
    storage.setItem('lotto.backtest.v1', 'backtest bytes');
    const store = new SavedPortfolioStore(storage);

    store.save(first);

    expect(store.list()).toEqual([first]);
    expect(storage.getItem('lotto.dataset.v1')).toBe('dataset bytes');
    expect(storage.getItem('lotto.analysis.v1')).toBe('analysis bytes');
    expect(storage.getItem('lotto.backtest.v1')).toBe('backtest bytes');
  });

  it('rejects corrupt saved bytes without deleting or replacing them', () => {
    const storage = new MemoryStorage();
    storage.setItem('lotto.saved-portfolios.v1', '{broken');
    const store = new SavedPortfolioStore(storage);

    expect(() => store.list()).toThrow('저장된 조합');
    expect(storage.getItem('lotto.saved-portfolios.v1')).toBe('{broken');
  });

  it('keeps saved portfolios when public cached data is corrupt', async () => {
    const storage = new MemoryStorage();
    const store = new SavedPortfolioStore(storage);
    store.save(first);
    storage.setItem('lotto.dataset.v1', '{broken');

    await expect(loadAppData(async () => new Response('{"bad":true}'), storage))
      .rejects.toThrow('로또 데이터');
    expect(store.list()).toEqual([first]);
  });

  it('rejects unknown schemas and unsorted or duplicate combinations', () => {
    const storage = new MemoryStorage();
    const store = new SavedPortfolioStore(storage);

    expect(() => store.save({ ...first, schemaVersion: 2 } as never)).toThrow();
    expect(() => store.save({ ...first, combinations: [[1, 1, 17, 28, 34, 45]] } as never)).toThrow();
    expect(() => store.save({ ...first, combinations: [[9, 1, 17, 28, 34, 45]] } as never)).toThrow();
    expect(storage.getItem('lotto.saved-portfolios.v1')).toBeNull();
  });

  it('rejects an unknown stored schema without changing its bytes', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 2, portfolios: [first] });
    storage.setItem('lotto.saved-portfolios.v1', raw);

    expect(() => new SavedPortfolioStore(storage).list()).toThrow('저장된 조합');
    expect(storage.getItem('lotto.saved-portfolios.v1')).toBe(raw);
  });

  it('deletes only the selected saved portfolio and preserves every other record', () => {
    const storage = new MemoryStorage();
    const store = new SavedPortfolioStore(storage);
    store.save(first);
    store.save(second);

    store.delete('first');

    expect(store.list()).toEqual([second]);
  });
});
