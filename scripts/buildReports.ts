import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AnalysisReport, AnalysisWindow, Histogram } from '../src/domain/analysis';
import { analyzeDraws } from '../src/domain/analysis';
import type { BacktestConfig, BacktestReport } from '../src/domain/backtest';
import {
  DEFAULT_BACKTEST_CONFIG,
  parseBacktestReport,
  runBacktest,
} from '../src/domain/backtest';
import { parseDrawDataset } from '../src/domain/draw';

const DEFAULT_DRAWS_PATH = resolve(process.cwd(), 'public/data/draws.json');
const DEFAULT_ANALYSIS_PATH = resolve(process.cwd(), 'public/data/analysis.json');
const DEFAULT_BACKTEST_PATH = resolve(process.cwd(), 'public/data/backtest.json');

export interface AnalysisFileReport {
  schemaVersion: 1;
  latestDraw: number;
  generatedAt: string;
  metrics: AnalysisReport;
}

export interface BacktestFileReport extends BacktestReport {
  generatedAt: string;
}

export interface ReportBuildOptions {
  drawsPath?: string;
  analysisPath?: string;
  backtestPath?: string;
  config?: BacktestConfig;
}

export interface ReportBuildDependencies {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface ReportBuildResult {
  latestDraw: number;
  evaluationTargetCount: number;
}

const defaultDependencies: ReportBuildDependencies = {
  readText: (path) => readFile(path, 'utf8'),
  writeText: (path, content) => writeFile(path, content, 'utf8'),
  rename,
  remove: (path) => rm(path, { force: true }),
};

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

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(serialized: string, name: string): unknown {
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    throw new Error(`${name} JSON이 올바르지 않습니다.`);
  }
}

async function readPriorArtifact(
  path: string,
  dependencies: ReportBuildDependencies,
): Promise<string | undefined> {
  try {
    return await dependencies.readText(path);
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function restorePriorArtifact(
  path: string,
  priorContent: string | undefined,
  dependencies: ReportBuildDependencies,
): Promise<void> {
  if (priorContent === undefined) {
    await dependencies.remove(path);
    return;
  }

  const restorePath = `${path}.restore.tmp`;
  try {
    await dependencies.writeText(restorePath, priorContent);
    await dependencies.rename(restorePath, path);
  } finally {
    await dependencies.remove(restorePath).catch(() => undefined);
  }
}

export async function buildReports(
  options: ReportBuildOptions = {},
  dependencies: ReportBuildDependencies = defaultDependencies,
): Promise<ReportBuildResult> {
  const drawsPath = options.drawsPath ?? DEFAULT_DRAWS_PATH;
  const analysisPath = options.analysisPath ?? DEFAULT_ANALYSIS_PATH;
  const backtestPath = options.backtestPath ?? DEFAULT_BACKTEST_PATH;
  const analysisTempPath = `${analysisPath}.tmp`;
  const backtestTempPath = `${backtestPath}.tmp`;
  let priorAnalysis: string | undefined;
  let priorBacktest: string | undefined;
  let analysisReplaced = false;
  let backtestReplaced = false;

  try {
    const dataset = parseDrawDataset(parseJson(
      await dependencies.readText(drawsPath),
      '추첨 데이터',
    ));
    const analysisReport: AnalysisFileReport = {
      schemaVersion: 1,
      latestDraw: dataset.latestDraw,
      generatedAt: dataset.generatedAt,
      metrics: analyzeDraws(dataset.draws),
    };
    const backtestReport: BacktestFileReport = {
      ...runBacktest(dataset.draws, options.config ?? DEFAULT_BACKTEST_CONFIG),
      generatedAt: dataset.generatedAt,
    };
    const serializedAnalysis = serialize(analysisReport);
    const serializedBacktest = serialize(backtestReport);

    await dependencies.writeText(analysisTempPath, serializedAnalysis);
    await dependencies.writeText(backtestTempPath, serializedBacktest);

    const validatedAnalysis = parseAnalysisFileReport(parseJson(
      await dependencies.readText(analysisTempPath),
      '임시 분석 보고서',
    ));
    const validatedBacktest = parseBacktestFileReport(parseJson(
      await dependencies.readText(backtestTempPath),
      '임시 백테스트 보고서',
    ));
    if (serialize(validatedAnalysis) !== serializedAnalysis
      || serialize(validatedBacktest) !== serializedBacktest) {
      throw new Error('임시 보고서가 검증된 후보와 일치하지 않습니다.');
    }

    [priorAnalysis, priorBacktest] = await Promise.all([
      readPriorArtifact(analysisPath, dependencies),
      readPriorArtifact(backtestPath, dependencies),
    ]);
    await dependencies.rename(analysisTempPath, analysisPath);
    analysisReplaced = true;
    await dependencies.rename(backtestTempPath, backtestPath);
    backtestReplaced = true;

    return {
      latestDraw: dataset.latestDraw,
      evaluationTargetCount: backtestReport.evaluation.targetCount,
    };
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    if (backtestReplaced) {
      await restorePriorArtifact(backtestPath, priorBacktest, dependencies)
        .catch((rollbackError) => rollbackErrors.push(rollbackError));
    }
    if (analysisReplaced) {
      await restorePriorArtifact(analysisPath, priorAnalysis, dependencies)
        .catch((rollbackError) => rollbackErrors.push(rollbackError));
    }
    await Promise.all([
      dependencies.remove(analysisTempPath).catch(() => undefined),
      dependencies.remove(backtestTempPath).catch(() => undefined),
    ]);
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], '보고서 교체 실패 후 이전 산출물 복원에도 실패했습니다.');
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const startedAt = performance.now();
  const result = await buildReports();
  const elapsedSeconds = (performance.now() - startedAt) / 1_000;
  console.log(
    `보고서 생성 완료: 최신 ${result.latestDraw}회, 평가 ${result.evaluationTargetCount}회, ${elapsedSeconds.toFixed(2)}초`,
  );
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
