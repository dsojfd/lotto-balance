export type Combination = readonly [number, number, number, number, number, number];

export interface Draw {
  drawNo: number;
  drawDate: string;
  numbers: Combination;
  bonus: number;
}

export interface DrawDataset {
  schemaVersion: 1;
  generatedAt: string;
  latestDraw: number;
  sourceUrl: string;
  draws: Draw[];
}

export function combinationKey(numbers: Combination): string {
  return numbers.join('-');
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isCanonicalUtcInstant(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function validateDraw(raw: unknown, expectedDrawNo: number): Draw {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${expectedDrawNo}회 데이터가 객체가 아닙니다.`);
  }

  const value = raw as Partial<Draw>;
  if (value.drawNo !== expectedDrawNo || !Number.isInteger(value.drawNo)) {
    throw new Error('회차가 올바르지 않습니다.');
  }
  if (typeof value.drawDate !== 'string' || !isCalendarDate(value.drawDate)) {
    throw new Error('추첨일 형식이 올바르지 않습니다.');
  }
  if (!Array.isArray(value.numbers) || value.numbers.length !== 6) {
    throw new Error('당첨번호는 6개여야 합니다.');
  }
  if (value.numbers.some((number) => !Number.isInteger(number) || number < 1 || number > 45)) {
    throw new Error('당첨번호 범위가 올바르지 않습니다.');
  }
  if (new Set(value.numbers).size !== 6) {
    throw new Error('당첨번호가 중복되었습니다.');
  }
  if (value.numbers.some((number, index) => index > 0 && number <= value.numbers![index - 1])) {
    throw new Error('당첨번호가 오름차순이 아닙니다.');
  }
  const bonus = value.bonus;
  if (!Number.isInteger(bonus)
    || bonus === undefined
    || bonus < 1
    || bonus > 45
    || value.numbers.includes(bonus)) {
    throw new Error('보너스 번호가 올바르지 않습니다.');
  }

  return value as Draw;
}

export function parseDrawDataset(raw: unknown): DrawDataset {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('데이터셋 객체가 아닙니다.');
  }

  const data = raw as Partial<DrawDataset>;
  if (data.schemaVersion !== 1 || !Array.isArray(data.draws) || data.draws.length === 0) {
    throw new Error('지원하지 않는 데이터셋입니다.');
  }
  if (typeof data.generatedAt !== 'string' || !isCanonicalUtcInstant(data.generatedAt)) {
    throw new Error('생성 시각이 올바르지 않습니다.');
  }
  if (data.sourceUrl !== 'https://www.dhlottery.co.kr/lt645/result') {
    throw new Error('공식 출처가 올바르지 않습니다.');
  }

  const draws = data.draws.map((value, index) => validateDraw(value, index + 1));
  if (draws.some((draw, index) => index > 0 && draw.drawDate <= draws[index - 1].drawDate)) {
    throw new Error('추첨일이 엄격히 증가하지 않습니다.');
  }
  if (data.latestDraw !== draws.at(-1)?.drawNo) {
    throw new Error('최신 회차가 일치하지 않습니다.');
  }

  return { ...data, draws } as DrawDataset;
}
