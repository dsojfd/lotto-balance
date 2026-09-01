import type { AnalysisReport, AnalysisWindow, Histogram } from '../domain/analysis';
import { parseBacktestReport, type BacktestReport } from '../domain/backtest';
import { parseDrawDataset, type DrawDataset } from '../domain/draw';

export const APP_DATA_CACHE_KEYS = {
  dataset: 'lotto.dataset.v1',
  analysis: 'lotto.analysis.v1',
  backtest: 'lotto.backtest.v1',
} as const;

export interface AnalysisFileReport {
  schemaVersion: 1;
  latestDraw: number;
  generatedAt: string;
  metrics: AnalysisReport;
}

export interface BacktestFileReport extends BacktestReport {
  generatedAt: string;
}

export interface AppDataState {
  dataset: DrawDataset;
  analysis: AnalysisFileReport;
  backtest: BacktestFileReport;
  isOfflineFallback: boolean;
}

export type AppDataFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface AppDataBundle {
  dataset: DrawDataset;
  analysis: AnalysisFileReport;
  backtest: BacktestFileReport;
}

const SHAPE_FIELDS = [
  'oddCount',
  'lowCount',
  'sum',
  'range',
  'sectionCount',
  'adjacentPairs',
  'duplicateEndings',
] as const;
const FIXED_SECTIONS = ['1-10', '11-20', '21-30', '31-40', '41-45'] as const;
const WINDOWS = ['all', '10', '30', '50', '100'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCanonicalUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function isCountHistogram(value: unknown): value is Histogram {
  return isRecord(value)
    && Object.values(value).every((count) => Number.isInteger(count) && (count as number) >= 0);
}

function parseAnalysisWindow(value: unknown, name: string): AnalysisWindow {
  if (!isRecord(value)
    || !Number.isInteger(value.drawCount)
    || (value.drawCount as number) < 0
    || !Array.isArray(value.numbers)
    || value.numbers.length !== 45
    || !isRecord(value.shapeHistograms)
    || !isRecord(value.fixedSectionCounts)
    || !isCountHistogram(value.pairCounts)
    || !Number.isInteger(value.pairSampleSize)
    || value.pairSampleSize !== value.drawCount
    || !isCountHistogram(value.previousDrawReuse)
    || !Number.isInteger(value.previousDrawReuseSampleSize)
    || value.previousDrawReuseSampleSize !== Math.max(0, (value.drawCount as number) - 1)) {
    throw new Error(`${name} 분석 구간이 올바르지 않습니다.`);
  }

  value.numbers.forEach((numberAnalysis, index) => {
    if (!isRecord(numberAnalysis)
      || numberAnalysis.number !== index + 1
      || !Number.isInteger(numberAnalysis.appearances)
      || (numberAnalysis.appearances as number) < 0
      || typeof numberAnalysis.expected !== 'number'
      || !Number.isFinite(numberAnalysis.expected)
      || typeof numberAnalysis.delta !== 'number'
      || !Number.isFinite(numberAnalysis.delta)
      || !Number.isInteger(numberAnalysis.absence)
      || (numberAnalysis.absence as number) < 0) {
      throw new Error(`${name} 번호 분석이 올바르지 않습니다.`);
    }
  });

  const shapeHistograms = value.shapeHistograms as Record<string, unknown>;
  const fixedSectionCounts = value.fixedSectionCounts as Record<string, unknown>;
  if (SHAPE_FIELDS.some((field) => !isCountHistogram(shapeHistograms[field]))
    || FIXED_SECTIONS.some((section) => !isCountHistogram(fixedSectionCounts[section]))) {
    throw new Error(`${name} 형태 분석이 올바르지 않습니다.`);
  }

  return value as unknown as AnalysisWindow;
}

export function parseAnalysisFileReport(raw: unknown): AnalysisFileReport {
  if (!isRecord(raw)
    || raw.schemaVersion !== 1
    || !Number.isInteger(raw.latestDraw)
    || (raw.latestDraw as number) <= 0
    || !isCanonicalUtcInstant(raw.generatedAt)
    || !isRecord(raw.metrics)
    || !isRecord(raw.metrics.windows)) {
    throw new Error('분석 보고서 형식이 올바르지 않습니다.');
  }

  const metrics = raw.metrics as Record<string, unknown>;
  const windows = metrics.windows as Record<string, unknown>;
  WINDOWS.forEach((window) => parseAnalysisWindow(windows[window], window));
  if ((windows.all as Record<string, unknown>).drawCount !== raw.latestDraw) {
    throw new Error('분석 보고서 최신 회차가 집계와 일치하지 않습니다.');
  }

  return raw as unknown as AnalysisFileReport;
}

export function parseBacktestFileReport(raw: unknown): BacktestFileReport {
  if (!isRecord(raw) || !isCanonicalUtcInstant(raw.generatedAt)) {
    throw new Error('백테스트 보고서 생성 시각이 올바르지 않습니다.');
  }
  parseBacktestReport(raw);
  return raw as unknown as BacktestFileReport;
}

function parseBundle(raw: {
  dataset: unknown;
  analysis: unknown;
  backtest: unknown;
}): AppDataBundle {
  const bundle = {
    dataset: parseDrawDataset(raw.dataset),
    analysis: parseAnalysisFileReport(raw.analysis),
    backtest: parseBacktestFileReport(raw.backtest),
  };
  if (bundle.dataset.latestDraw !== bundle.analysis.latestDraw
    || bundle.dataset.latestDraw !== bundle.backtest.latestDraw
    || bundle.dataset.generatedAt !== bundle.analysis.generatedAt
    || bundle.dataset.generatedAt !== bundle.backtest.generatedAt) {
    throw new Error('데이터 묶음의 최신 회차 또는 생성 시각이 일치하지 않습니다.');
  }
  return bundle;
}

function readCachedBundle(storage: Storage): AppDataBundle | undefined {
  try {
    const dataset = storage.getItem(APP_DATA_CACHE_KEYS.dataset);
    const analysis = storage.getItem(APP_DATA_CACHE_KEYS.analysis);
    const backtest = storage.getItem(APP_DATA_CACHE_KEYS.backtest);
    if (dataset === null || analysis === null || backtest === null) return undefined;
    return parseBundle({
      dataset: JSON.parse(dataset) as unknown,
      analysis: JSON.parse(analysis) as unknown,
      backtest: JSON.parse(backtest) as unknown,
    });
  } catch {
    return undefined;
  }
}

async function fetchNetworkBundle(fetcher: AppDataFetcher): Promise<AppDataBundle> {
  const urls = ['./data/draws.json', './data/analysis.json', './data/backtest.json'] as const;
  const responses = await Promise.all(urls.map(async (url) => {
    const response = await fetcher(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} 요청이 실패했습니다.`);
    return response;
  }));
  const [dataset, analysis, backtest] = await Promise.all(responses.map((response) => response.json()));
  return parseBundle({ dataset, analysis, backtest });
}

async function canReachOrigin(fetcher: AppDataFetcher): Promise<boolean> {
  try {
    const response = await fetcher('./manifest.webmanifest', {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

function persistBundle(storage: Storage, bundle: AppDataBundle): void {
  const entries = [
    [APP_DATA_CACHE_KEYS.dataset, JSON.stringify(bundle.dataset)],
    [APP_DATA_CACHE_KEYS.analysis, JSON.stringify(bundle.analysis)],
    [APP_DATA_CACHE_KEYS.backtest, JSON.stringify(bundle.backtest)],
  ] as const;
  const previous = entries.map(([key]) => [key, storage.getItem(key)] as const);
  let written = 0;

  try {
    entries.forEach(([key, value]) => {
      storage.setItem(key, value);
      written += 1;
    });
  } catch (error) {
    previous.slice(0, written).reverse().forEach(([key, value]) => {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    });
    throw error;
  }
}

export async function loadAppData(
  fetcher: AppDataFetcher = fetch,
  storage: Storage = localStorage,
): Promise<AppDataState> {
  const cached = readCachedBundle(storage);
  let network: AppDataBundle;
  try {
    network = await fetchNetworkBundle(fetcher);
  } catch {
    if (cached) return { ...cached, isOfflineFallback: true };
    throw new Error('로또 데이터를 불러올 수 없습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
  }

  try {
    persistBundle(storage, network);
  } catch {
    // The validated network bundle remains usable when device cache persistence fails.
  }
  return { ...network, isOfflineFallback: !(await canReachOrigin(fetcher)) };
}
