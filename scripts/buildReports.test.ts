import { describe, expect, it } from 'vitest';
import type { DrawDataset } from '../src/domain/draw';
import type { ReportBuildDependencies } from './buildReports';
import {
  buildReports,
  parseAnalysisFileReport,
  parseBacktestFileReport,
} from './buildReports';

const DRAW_PATH = 'public/data/draws.json';
const ANALYSIS_PATH = 'public/data/analysis.json';
const BACKTEST_PATH = 'public/data/backtest.json';

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

interface MemoryOptions {
  corruptTempPath?: string;
  failRenameFrom?: string;
  failReadPath?: string;
}

function memoryDependencies(options: MemoryOptions = {}) {
  const files = new Map<string, string>([
    [DRAW_PATH, `${JSON.stringify(dataset)}\n`],
    [ANALYSIS_PATH, 'prior analysis'],
    [BACKTEST_PATH, 'prior backtest'],
  ]);
  const operations: string[] = [];
  const dependencies: ReportBuildDependencies = {
    readText: async (path) => {
      operations.push(`read:${path}`);
      if (path === options.failReadPath) throw new Error('read denied');
      const value = files.get(path);
      if (value === undefined) throw new Error(`missing: ${path}`);
      return value;
    },
    writeText: async (path, content) => {
      operations.push(`write:${path}`);
      files.set(path, path === options.corruptTempPath ? '{broken' : content);
    },
    rename: async (from, to) => {
      operations.push(`rename:${from}->${to}`);
      if (from === options.failRenameFrom) throw new Error('rename failed');
      const content = files.get(from);
      if (content === undefined) throw new Error(`missing: ${from}`);
      files.set(to, content);
      files.delete(from);
    },
    remove: async (path) => {
      operations.push(`remove:${path}`);
      files.delete(path);
    },
  };
  return { dependencies, files, operations };
}

const config = {
  minimumTrainingDraws: 2,
  gamesPerPortfolio: 1,
  portfoliosPerTarget: 1,
  seed: 0x6452026,
} as const;

describe('generated reports', () => {
  it('uses the validated dataset timestamp and produces runtime-valid report payloads', async () => {
    const { dependencies, files } = memoryDependencies();

    await buildReports({
      drawsPath: DRAW_PATH,
      analysisPath: ANALYSIS_PATH,
      backtestPath: BACKTEST_PATH,
      config,
    }, dependencies);

    const analysis = parseAnalysisFileReport(JSON.parse(files.get(ANALYSIS_PATH)!));
    const backtest = parseBacktestFileReport(JSON.parse(files.get(BACKTEST_PATH)!));
    expect(analysis.generatedAt).toBe(dataset.generatedAt);
    expect(backtest.generatedAt).toBe(dataset.generatedAt);
    expect(analysis.latestDraw).toBe(4);
    expect(backtest.latestDraw).toBe(4);
  });

  it('writes and validates both temporary reports before renaming either artifact', async () => {
    const { dependencies, operations } = memoryDependencies();

    await buildReports({
      drawsPath: DRAW_PATH,
      analysisPath: ANALYSIS_PATH,
      backtestPath: BACKTEST_PATH,
      config,
    }, dependencies);

    const firstRename = operations.findIndex((operation) => operation.startsWith('rename:'));
    const tempReads = operations
      .map((operation, index) => ({ operation, index }))
      .filter(({ operation }) => operation === `read:${ANALYSIS_PATH}.tmp` || operation === `read:${BACKTEST_PATH}.tmp`);
    expect(tempReads).toHaveLength(2);
    expect(tempReads.every(({ index }) => index < firstRename)).toBe(true);
  });

  it('leaves both prior artifacts untouched if either temporary report fails validation', async () => {
    const { dependencies, files, operations } = memoryDependencies({
      corruptTempPath: `${BACKTEST_PATH}.tmp`,
    });

    await expect(buildReports({
      drawsPath: DRAW_PATH,
      analysisPath: ANALYSIS_PATH,
      backtestPath: BACKTEST_PATH,
      config,
    }, dependencies)).rejects.toThrow();

    expect(files.get(ANALYSIS_PATH)).toBe('prior analysis');
    expect(files.get(BACKTEST_PATH)).toBe('prior backtest');
    expect(operations.some((operation) => operation.startsWith('rename:'))).toBe(false);
    expect(files.has(`${ANALYSIS_PATH}.tmp`)).toBe(false);
    expect(files.has(`${BACKTEST_PATH}.tmp`)).toBe(false);
  });

  it('restores both prior artifacts if the second atomic rename fails', async () => {
    const { dependencies, files } = memoryDependencies({
      failRenameFrom: `${BACKTEST_PATH}.tmp`,
    });

    await expect(buildReports({
      drawsPath: DRAW_PATH,
      analysisPath: ANALYSIS_PATH,
      backtestPath: BACKTEST_PATH,
      config,
    }, dependencies)).rejects.toThrow('rename failed');

    expect(files.get(ANALYSIS_PATH)).toBe('prior analysis');
    expect(files.get(BACKTEST_PATH)).toBe('prior backtest');
    expect(files.has(`${ANALYSIS_PATH}.tmp`)).toBe(false);
    expect(files.has(`${BACKTEST_PATH}.tmp`)).toBe(false);
  });

  it('does not replace either artifact when a prior artifact cannot be read for rollback', async () => {
    const { dependencies, files } = memoryDependencies({ failReadPath: ANALYSIS_PATH });

    await expect(buildReports({
      drawsPath: DRAW_PATH,
      analysisPath: ANALYSIS_PATH,
      backtestPath: BACKTEST_PATH,
      config,
    }, dependencies)).rejects.toThrow('read denied');

    expect(files.get(ANALYSIS_PATH)).toBe('prior analysis');
    expect(files.get(BACKTEST_PATH)).toBe('prior backtest');
  });

  it('fails closed on malformed analysis and backtest file reports', () => {
    expect(() => parseAnalysisFileReport({ schemaVersion: 1 })).toThrow();
    expect(() => parseBacktestFileReport({ schemaVersion: 1 })).toThrow();
  });
});
