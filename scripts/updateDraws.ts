import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Draw, DrawDataset } from '../src/domain/draw';
import { parseDrawDataset } from '../src/domain/draw';
import { fetchOfficialDraws } from './officialClient';

const DEFAULT_DATA_PATH = resolve(process.cwd(), 'public/data/draws.json');
const MAX_UPDATE_DRAWS = 60;

export interface DrawUpdateDependencies {
  fetchDraws(query: 'all' | number): Promise<Draw[]>;
  now(): Date;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface DrawUpdateOptions {
  bootstrap?: boolean;
  dataPath?: string;
}

export interface DrawUpdateResult {
  changed: boolean;
  appended: number;
  latestDraw: number;
}

const defaultDependencies: DrawUpdateDependencies = {
  fetchDraws: fetchOfficialDraws,
  now: () => new Date(),
  readText: (path) => readFile(path, 'utf8'),
  writeText: (path, content) => writeFile(path, content, 'utf8'),
  rename,
  remove: (path) => rm(path, { force: true }),
};

function sameDraw(left: Draw, right: Draw): boolean {
  return left.drawNo === right.drawNo
    && left.drawDate === right.drawDate
    && left.bonus === right.bonus
    && left.numbers.length === right.numbers.length
    && left.numbers.every((number, index) => number === right.numbers[index]);
}

export function mergeOfficialDraws(
  existing: DrawDataset,
  incoming: Draw[],
  generatedAt = new Date().toISOString(),
): DrawDataset {
  const validatedExisting = parseDrawDataset(existing);
  if (incoming.length === 0) return existing;

  const drawsByNumber = new Map<number, Draw>(
    validatedExisting.draws.map((draw) => [draw.drawNo, draw]),
  );
  let changed = false;

  for (const draw of [...incoming].sort((left, right) => left.drawNo - right.drawNo)) {
    const prior = drawsByNumber.get(draw.drawNo);
    if (prior) {
      if (!sameDraw(prior, draw)) {
        throw new Error(`${draw.drawNo}회 공식 데이터가 기존 데이터와 충돌합니다.`);
      }
      continue;
    }
    drawsByNumber.set(draw.drawNo, draw);
    changed = true;
  }

  if (!changed) return existing;

  const draws = [...drawsByNumber.values()].sort(
    (left, right) => left.drawNo - right.drawNo,
  );
  return parseDrawDataset({
    schemaVersion: 1,
    generatedAt,
    latestDraw: draws.at(-1)?.drawNo,
    sourceUrl: validatedExisting.sourceUrl,
    draws,
  });
}

function parseSerializedDataset(serialized: string): DrawDataset {
  return parseDrawDataset(JSON.parse(serialized) as unknown);
}

function serializeDataset(dataset: DrawDataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

export async function runDrawUpdate(
  options: DrawUpdateOptions = {},
  dependencies: DrawUpdateDependencies = defaultDependencies,
): Promise<DrawUpdateResult> {
  const dataPath = options.dataPath ?? DEFAULT_DATA_PATH;
  const tempPath = `${dataPath}.tmp`;

  try {
    const original = await dependencies.readText(dataPath);
    const existing = parseSerializedDataset(original);
    const generatedAt = dependencies.now().toISOString();
    let candidate = existing;
    let appended = 0;

    if (options.bootstrap) {
      const officialHistory = await dependencies.fetchDraws('all');
      if (officialHistory.length === 0) {
        return { changed: false, appended: 0, latestDraw: existing.latestDraw };
      }
      candidate = mergeOfficialDraws(existing, officialHistory, generatedAt);
      appended = candidate.latestDraw - existing.latestDraw;
    } else {
      while (true) {
        const expectedDraw = candidate.latestDraw + 1;
        const official = await dependencies.fetchDraws(expectedDraw);
        if (official.length === 0) break;
        if (official.length !== 1 || official[0].drawNo !== expectedDraw) {
          throw new Error(`공식 응답에 정확한 ${expectedDraw}회 데이터가 없습니다.`);
        }

        candidate = mergeOfficialDraws(candidate, official, generatedAt);
        appended += 1;
        if (appended >= MAX_UPDATE_DRAWS) {
          throw new Error(`한 번의 갱신에서 ${MAX_UPDATE_DRAWS}회 한도에 도달했습니다.`);
        }
      }
    }

    if (candidate === existing) {
      return { changed: false, appended: 0, latestDraw: existing.latestDraw };
    }

    const serializedCandidate = serializeDataset(candidate);
    await dependencies.writeText(tempPath, serializedCandidate);
    const tempSerialized = await dependencies.readText(tempPath);
    const validatedTemp = parseSerializedDataset(tempSerialized);
    if (serializeDataset(validatedTemp) !== serializedCandidate) {
      throw new Error('임시 데이터가 검증된 후보와 일치하지 않습니다.');
    }
    await dependencies.rename(tempPath, dataPath);

    return { changed: true, appended, latestDraw: candidate.latestDraw };
  } catch (error) {
    await dependencies.remove(tempPath).catch(() => undefined);
    throw error;
  }
}

async function main(): Promise<void> {
  const bootstrap = process.argv.slice(2).includes('--bootstrap');
  const result = await runDrawUpdate({ bootstrap });
  if (result.changed) {
    console.log(`${result.appended}개 회차를 반영했습니다. 최신 ${result.latestDraw}회`);
  } else {
    console.log(`새 공식 회차가 없습니다. 최신 ${result.latestDraw}회`);
  }
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
