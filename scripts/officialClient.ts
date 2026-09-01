import type { Draw } from '../src/domain/draw';
import { parseDrawDataset } from '../src/domain/draw';

const BASE_URL = 'https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do';
const SOURCE_URL = 'https://www.dhlottery.co.kr/lt645/result';

function validateMappedDraw(candidate: Draw): Draw {
  if (!Number.isInteger(candidate.drawNo) || candidate.drawNo < 1) {
    throw new Error('공식 회차가 올바르지 않습니다.');
  }

  const validated = parseDrawDataset({
    schemaVersion: 1,
    generatedAt: '2000-01-01T00:00:00.000Z',
    latestDraw: 1,
    sourceUrl: SOURCE_URL,
    draws: [{ ...candidate, drawNo: 1 }],
  }).draws[0];

  return { ...validated, drawNo: candidate.drawNo };
}

export function mapOfficialRecord(raw: unknown): Draw {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('공식 회차 레코드가 객체가 아닙니다.');
  }

  const item = raw as Record<string, unknown>;
  const date = String(item.ltRflYmd);
  const candidate = {
    drawNo: Number(item.ltEpsd),
    drawDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    numbers: [1, 2, 3, 4, 5, 6].map(
      (number) => Number(item[`tm${number}WnNo`]),
    ) as unknown as Draw['numbers'],
    bonus: Number(item.bnsWnNo),
  };

  return validateMappedDraw(candidate);
}

export async function fetchOfficialDraws(
  query: 'all' | number,
  fetcher: typeof fetch = fetch,
): Promise<Draw[]> {
  const url = `${BASE_URL}?srchLtEpsd=${query}`;
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'application/json',
      Referer: SOURCE_URL,
      'User-Agent': 'lotto-balance-updater/1.0',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!response.ok) {
    throw new Error(`공식 데이터 요청 실패: ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('공식 응답 본문이 객체가 아닙니다.');
  }
  const data = (body as Record<string, unknown>).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('공식 응답에 data 객체가 없습니다.');
  }
  const list = (data as Record<string, unknown>).list;
  if (!Array.isArray(list)) {
    throw new Error('공식 응답에 회차 목록이 없습니다.');
  }

  return list.map(mapOfficialRecord);
}
