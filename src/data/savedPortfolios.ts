import type { Combination } from '../domain/draw';

export const SAVED_PORTFOLIOS_KEY = 'lotto.saved-portfolios.v1';

export interface SavedPortfolio {
  id: string;
  schemaVersion: 1;
  targetDrawNo: number;
  mode: 'balanced' | 'random';
  createdAt: string;
  combinations: Combination[];
}

interface SavedPortfolioFile {
  schemaVersion: 1;
  portfolios: SavedPortfolio[];
}

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

function parseCombination(value: unknown): Combination {
  if (!Array.isArray(value)
    || value.length !== 6
    || value.some((number) => !Number.isInteger(number) || number < 1 || number > 45)
    || new Set(value).size !== 6
    || value.some((number, index) => index > 0 && number <= value[index - 1])) {
    throw new Error('저장된 조합 번호가 올바르지 않습니다.');
  }
  return value as unknown as Combination;
}

function parsePortfolio(value: unknown): SavedPortfolio {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || value.id.trim() === ''
    || value.schemaVersion !== 1
    || !Number.isInteger(value.targetDrawNo)
    || (value.targetDrawNo as number) <= 0
    || (value.mode !== 'balanced' && value.mode !== 'random')
    || !isCanonicalUtcInstant(value.createdAt)
    || !Array.isArray(value.combinations)
    || (value.combinations.length !== 1 && value.combinations.length !== 5 && value.combinations.length !== 10)) {
    throw new Error('저장된 조합 형식이 올바르지 않습니다.');
  }
  return {
    id: value.id,
    schemaVersion: 1,
    targetDrawNo: value.targetDrawNo as number,
    mode: value.mode,
    createdAt: value.createdAt,
    combinations: value.combinations.map(parseCombination),
  };
}

function parseFile(value: unknown): SavedPortfolioFile {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.portfolios)) {
    throw new Error('저장된 조합 데이터 형식이 올바르지 않습니다.');
  }
  const portfolios = value.portfolios.map(parsePortfolio);
  if (new Set(portfolios.map((portfolio) => portfolio.id)).size !== portfolios.length) {
    throw new Error('저장된 조합 식별자가 중복되었습니다.');
  }
  return { schemaVersion: 1, portfolios };
}

export class SavedPortfolioStore {
  constructor(private readonly storage: Storage) {}

  list(): SavedPortfolio[] {
    const raw = this.storage.getItem(SAVED_PORTFOLIOS_KEY);
    if (raw === null) return [];
    try {
      return parseFile(JSON.parse(raw) as unknown).portfolios;
    } catch {
      throw new Error('저장된 조합 데이터를 읽을 수 없습니다.');
    }
  }

  save(portfolio: SavedPortfolio): void {
    const validated = parsePortfolio(portfolio);
    const portfolios = this.list();
    const existingIndex = portfolios.findIndex((existing) => existing.id === validated.id);
    if (existingIndex === -1) portfolios.push(validated);
    else portfolios[existingIndex] = validated;
    this.storage.setItem(SAVED_PORTFOLIOS_KEY, JSON.stringify({ schemaVersion: 1, portfolios }));
  }

  delete(id: string): void {
    const portfolios = this.list();
    const remaining = portfolios.filter((portfolio) => portfolio.id !== id);
    if (remaining.length === portfolios.length) return;
    if (remaining.length === 0) this.storage.removeItem(SAVED_PORTFOLIOS_KEY);
    else this.storage.setItem(SAVED_PORTFOLIOS_KEY, JSON.stringify({ schemaVersion: 1, portfolios: remaining }));
  }
}
