import { describe, expect, it } from 'vitest';
import { analyzeDraws } from '../domain/analysis';
import { runBacktest } from '../domain/backtest';
import type { DrawDataset } from '../domain/draw';
import { loadAppData } from './appData';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  private failOnSetKey?: string;

  failWritesFor(key: string): void { this.failOnSetKey = key; }

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void {
    if (key === this.failOnSetKey) throw new Error('storage write failed');
    this.values.set(key, value);
  }
}

const dataset: DrawDataset = {
  schemaVersion: 1,
  generatedAt: '2026-09-01T00:00:00.000Z',
  latestDraw: 4,
  sourceUrl: 'https://www.dhlottery.co.kr/lt645/result',
  draws: [
    { drawNo: 1, drawDate: '2002-12-07', numbers: [10, 23, 29, 33, 37, 40], bonus: 16 },
    { drawNo: 2, drawDate: '2002-12-14', numbers: [9, 13, 21, 25, 32, 42], bonus: 2 },
    { drawNo: 3, drawDate: '2002-12-21', numbers: [11, 16, 19, 21, 27, 31], bonus: 30 },
    { drawNo: 4, drawDate: '2002-12-28', numbers: [14, 27, 30, 31, 40, 42], bonus: 2 },
  ],
};

const analysis = {
  schemaVersion: 1,
  latestDraw: dataset.latestDraw,
  generatedAt: dataset.generatedAt,
  metrics: analyzeDraws(dataset.draws),
};

const backtest = {
  ...runBacktest(dataset.draws, {
    minimumTrainingDraws: 2,
    gamesPerPortfolio: 1,
    portfoliosPerTarget: 1,
    seed: 0x6452026,
  }),
  generatedAt: dataset.generatedAt,
};

const cacheKeys = ['lotto.dataset.v1', 'lotto.analysis.v1', 'lotto.backtest.v1'] as const;

function cacheBundle(storage: Storage): void {
  storage.setItem(cacheKeys[0], JSON.stringify(dataset));
  storage.setItem(cacheKeys[1], JSON.stringify(analysis));
  storage.setItem(cacheKeys[2], JSON.stringify(backtest));
}

function responseFor(url: string): Response {
  if (url === './data/draws.json') return new Response(JSON.stringify(dataset));
  if (url === './data/analysis.json') return new Response(JSON.stringify(analysis));
  return new Response(JSON.stringify(backtest));
}

describe('loadAppData', () => {
  it('validates and stores a coherent network bundle before returning it', async () => {
    const storage = new MemoryStorage();
    const calls: Array<[string, RequestInit | undefined]> = [];

    const state = await loadAppData(async (url, init) => {
      calls.push([String(url), init]);
      return responseFor(String(url));
    }, storage);

    expect(state).toMatchObject({ dataset, analysis, backtest, isOfflineFallback: false });
    expect(calls).toEqual([
      ['./data/draws.json', { cache: 'no-store' }],
      ['./data/analysis.json', { cache: 'no-store' }],
      ['./data/backtest.json', { cache: 'no-store' }],
    ]);
    expect(cacheKeys.map((key) => storage.getItem(key))).toEqual([
      JSON.stringify(dataset), JSON.stringify(analysis), JSON.stringify(backtest),
    ]);
  });

  it('uses only the complete cached bundle when every network payload is invalid', async () => {
    const storage = new MemoryStorage();
    cacheBundle(storage);

    const state = await loadAppData(async () => new Response('{"bad":true}'), storage);

    expect(state).toMatchObject({ dataset, analysis, backtest, isOfflineFallback: true });
  });

  it('does not replace any cached member when a validated network bundle disagrees on generation', async () => {
    const storage = new MemoryStorage();
    cacheBundle(storage);
    const oldValues = cacheKeys.map((key) => storage.getItem(key));
    const mismatchedAnalysis = { ...analysis, generatedAt: '2026-09-01T00:00:01.000Z' };

    const state = await loadAppData(async (url) => {
      if (url === './data/analysis.json') return new Response(JSON.stringify(mismatchedAnalysis));
      return responseFor(String(url));
    }, storage);

    expect(state.isOfflineFallback).toBe(true);
    expect(cacheKeys.map((key) => storage.getItem(key))).toEqual(oldValues);
  });

  it('returns the valid network bundle and restores the prior cache when persistence stops midway', async () => {
    const storage = new MemoryStorage();
    cacheBundle(storage);
    const oldValues = cacheKeys.map((key) => storage.getItem(key));
    storage.failWritesFor(cacheKeys[1]);
    const generatedAt = '2026-09-01T00:00:01.000Z';
    const newerDataset = { ...dataset, generatedAt };
    const newerAnalysis = { ...analysis, generatedAt };
    const newerBacktest = { ...backtest, generatedAt };

    const state = await loadAppData(async (url) => {
      if (url === './data/draws.json') return new Response(JSON.stringify(newerDataset));
      if (url === './data/analysis.json') return new Response(JSON.stringify(newerAnalysis));
      return new Response(JSON.stringify(newerBacktest));
    }, storage);

    expect(state).toMatchObject({ dataset: newerDataset, isOfflineFallback: false });
    expect(cacheKeys.map((key) => storage.getItem(key))).toEqual(oldValues);
  });

  it('returns a valid network bundle even when an empty cache cannot be written', async () => {
    const storage = new MemoryStorage();
    storage.failWritesFor(cacheKeys[0]);

    const state = await loadAppData(async (url) => responseFor(String(url)), storage);

    expect(state).toMatchObject({ dataset, analysis, backtest, isOfflineFallback: false });
    expect(cacheKeys.map((key) => storage.getItem(key))).toEqual([null, null, null]);
  });

  it('blocks in Korean when neither network nor cache contains one coherent bundle', async () => {
    const storage = new MemoryStorage();
    storage.setItem(cacheKeys[0], JSON.stringify(dataset));

    await expect(loadAppData(async () => new Response('{"bad":true}'), storage))
      .rejects.toThrow('로또 데이터');
    expect(storage.getItem(cacheKeys[0])).toBe(JSON.stringify(dataset));
  });
});
