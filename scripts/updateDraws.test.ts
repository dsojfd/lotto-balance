import { describe, expect, it } from 'vitest';
import type { Draw, DrawDataset } from '../src/domain/draw';
import { parseDrawDataset } from '../src/domain/draw';
import {
  mergeOfficialDraws,
  runDrawUpdate,
  type DrawUpdateDependencies,
} from './updateDraws';

const DATA_PATH = 'public/data/draws.json';
const SOURCE_URL = 'https://www.dhlottery.co.kr/lt645/result';

const existing: DrawDataset = {
  schemaVersion: 1,
  generatedAt: '2026-09-01T00:00:00.000Z',
  latestDraw: 2,
  sourceUrl: SOURCE_URL,
  draws: [
    { drawNo: 1, drawDate: '2002-12-07', numbers: [10, 23, 29, 33, 37, 40], bonus: 16 },
    { drawNo: 2, drawDate: '2002-12-14', numbers: [9, 13, 21, 25, 32, 42], bonus: 2 },
  ],
};

const draw3: Draw = {
  drawNo: 3,
  drawDate: '2002-12-21',
  numbers: [11, 16, 19, 21, 27, 31],
  bonus: 30,
};

function serialized(dataset: DrawDataset = existing): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

function makeSequentialDraw(drawNo: number): Draw {
  const date = new Date(Date.UTC(2002, 11, 7 + ((drawNo - 1) * 7)));
  return {
    drawNo,
    drawDate: date.toISOString().slice(0, 10),
    numbers: [1, 2, 3, 4, 5, 6],
    bonus: 7,
  };
}

interface MemoryFileOptions {
  corruptTempWrite?: boolean;
  failRename?: boolean;
}

function memoryDependencies(
  original: string,
  fetchDraws: DrawUpdateDependencies['fetchDraws'],
  options: MemoryFileOptions = {},
) {
  const files = new Map([[DATA_PATH, original]]);
  const operations: string[] = [];
  const dependencies: DrawUpdateDependencies = {
    fetchDraws,
    now: () => new Date('2026-09-01T01:02:03.004Z'),
    readText: async (path) => {
      operations.push(`read:${path}`);
      const value = files.get(path);
      if (value === undefined) throw new Error(`missing file: ${path}`);
      return value;
    },
    writeText: async (path, content) => {
      operations.push(`write:${path}`);
      files.set(path, options.corruptTempWrite ? '{broken' : content);
    },
    rename: async (from, to) => {
      operations.push(`rename:${from}->${to}`);
      if (options.failRename) throw new Error('rename failed');
      const value = files.get(from);
      if (value === undefined) throw new Error('missing temp file');
      files.set(to, value);
      files.delete(from);
    },
    remove: async (path) => {
      operations.push(`remove:${path}`);
      files.delete(path);
    },
  };
  return { dependencies, files, operations };
}

describe('mergeOfficialDraws', () => {
  it('returns the existing dataset unchanged for an empty official list', () => {
    expect(mergeOfficialDraws(existing, [])).toBe(existing);
  });

  it('appends the exact next draw and preserves the official source URL', () => {
    const merged = mergeOfficialDraws(existing, [draw3], '2026-09-01T01:02:03.004Z');

    expect(merged.latestDraw).toBe(3);
    expect(merged.draws.at(-1)).toEqual(draw3);
    expect(merged.sourceUrl).toBe(SOURCE_URL);
    expect(merged.generatedAt).toBe('2026-09-01T01:02:03.004Z');
    expect(() => parseDrawDataset(merged)).not.toThrow();
  });

  it('rejects a gap after sorting incoming draws', () => {
    expect(() => mergeOfficialDraws(existing, [{ ...draw3, drawNo: 4 }])).toThrow();
  });

  it('rejects a conflicting duplicate draw number', () => {
    const conflicting = { ...existing.draws[1], bonus: 3 };
    expect(() => mergeOfficialDraws(existing, [conflicting])).toThrow();
  });

  it('rejects malformed typed input through the domain dataset contract', () => {
    const malformed = { ...draw3, numbers: [11, 11, 19, 21, 27, 31] } as unknown as Draw;
    expect(() => mergeOfficialDraws(existing, [malformed])).toThrow();
  });
});

describe('runDrawUpdate', () => {
  it('leaves the serialized file byte-for-byte unchanged when no next draw is published', async () => {
    const original = serialized();
    const { dependencies, files, operations } = memoryDependencies(original, async () => []);

    await expect(runDrawUpdate({ dataPath: DATA_PATH }, dependencies)).resolves.toMatchObject({
      changed: false,
      appended: 0,
    });
    expect(files.get(DATA_PATH)).toBe(original);
    expect(operations).not.toContain(`write:${DATA_PATH}.tmp`);
  });

  it('catches up through successive exact draws before one atomic rename', async () => {
    const original = serialized();
    const queries: Array<'all' | number> = [];
    const draw4 = makeSequentialDraw(4);
    const { dependencies, files, operations } = memoryDependencies(original, async (query) => {
      queries.push(query);
      expect(files.get(DATA_PATH)).toBe(original);
      if (query === 3) return [draw3];
      if (query === 4) return [draw4];
      return [];
    });

    await expect(runDrawUpdate({ dataPath: DATA_PATH }, dependencies)).resolves.toEqual({
      changed: true,
      appended: 2,
      latestDraw: 4,
    });
    expect(queries).toEqual([3, 4, 5]);
    expect(operations.filter((operation) => operation.startsWith('rename:'))).toHaveLength(1);
    expect(parseDrawDataset(JSON.parse(files.get(DATA_PATH)!)).latestDraw).toBe(4);
  });

  it('rejects a non-exact response and preserves the original bytes', async () => {
    const original = serialized();
    const { dependencies, files } = memoryDependencies(original, async () => [{
      ...draw3,
      drawNo: 4,
    }]);

    await expect(runDrawUpdate({ dataPath: DATA_PATH }, dependencies)).rejects.toThrow();
    expect(files.get(DATA_PATH)).toBe(original);
    expect(files.has(`${DATA_PATH}.tmp`)).toBe(false);
  });

  it('fails at the 60-draw cap without committing a possibly stale candidate', async () => {
    const singleDrawDataset = parseDrawDataset({
      ...existing,
      latestDraw: 1,
      draws: [existing.draws[0]],
    });
    const original = serialized(singleDrawDataset);
    const { dependencies, files } = memoryDependencies(original, async (query) => {
      if (query === 'all') throw new Error('unexpected bootstrap');
      return [makeSequentialDraw(query)];
    });

    await expect(runDrawUpdate({ dataPath: DATA_PATH }, dependencies)).rejects.toThrow('60');
    expect(files.get(DATA_PATH)).toBe(original);
    expect(files.has(`${DATA_PATH}.tmp`)).toBe(false);
  });

  it.each([
    ['a malformed fetched draw', async () => [{ ...draw3, bonus: 11 }] as Draw[]],
    ['a fetch failure', async () => { throw new Error('network failed'); }],
  ])('preserves the original bytes after %s', async (_name, fetchDraws) => {
    const original = serialized();
    const { dependencies, files } = memoryDependencies(original, fetchDraws);

    await expect(runDrawUpdate({ dataPath: DATA_PATH }, dependencies)).rejects.toThrow();
    expect(files.get(DATA_PATH)).toBe(original);
    expect(files.has(`${DATA_PATH}.tmp`)).toBe(false);
  });

  it.each([
    ['temp-file validation failure', { corruptTempWrite: true }],
    ['atomic rename failure', { failRename: true }],
  ])('removes the temp file and preserves the original after %s', async (_name, options) => {
    const original = serialized();
    const { dependencies, files } = memoryDependencies(
      original,
      async (query) => query === 3 ? [draw3] : [],
      options,
    );

    await expect(runDrawUpdate({ dataPath: DATA_PATH }, dependencies)).rejects.toThrow();
    expect(files.get(DATA_PATH)).toBe(original);
    expect(files.has(`${DATA_PATH}.tmp`)).toBe(false);
  });

  it('bootstraps a complete official history and commits only after validation', async () => {
    const original = serialized({
      ...existing,
      latestDraw: 1,
      draws: [existing.draws[0]],
    });
    const queries: Array<'all' | number> = [];
    const { dependencies, files } = memoryDependencies(original, async (query) => {
      queries.push(query);
      expect(files.get(DATA_PATH)).toBe(original);
      return [draw3, ...existing.draws];
    });

    await expect(runDrawUpdate({ bootstrap: true, dataPath: DATA_PATH }, dependencies)).resolves.toEqual({
      changed: true,
      appended: 2,
      latestDraw: 3,
    });
    expect(queries).toEqual(['all']);
    expect(parseDrawDataset(JSON.parse(files.get(DATA_PATH)!)).latestDraw).toBe(3);
  });
});
