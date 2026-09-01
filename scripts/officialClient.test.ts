import { describe, expect, it } from 'vitest';
import fixture from '../tests/fixtures/official-draw-1201.json';
import { fetchOfficialDraws, mapOfficialRecord } from './officialClient';

describe('mapOfficialRecord', () => {
  it('maps the official field names without guessing', () => {
    expect(mapOfficialRecord(fixture.data.list[0])).toEqual({
      drawNo: 1201,
      drawDate: '2025-12-06',
      numbers: [7, 9, 24, 27, 35, 36],
      bonus: 37,
    });
  });

  it.each([
    ['an impossible date', { ...fixture.data.list[0], ltRflYmd: '20250229' }],
    ['an unsorted winning set', { ...fixture.data.list[0], tm2WnNo: 6 }],
    ['a colliding bonus', { ...fixture.data.list[0], bnsWnNo: 7 }],
    ['a non-integer draw number', { ...fixture.data.list[0], ltEpsd: 1201.5 }],
  ])('rejects %s through the domain draw contract', (_name, record) => {
    expect(() => mapOfficialRecord(record)).toThrow();
  });
});

describe('fetchOfficialDraws', () => {
  it('requests only the official endpoint and maps its complete response', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify(fixture), { status: 200 });
    }) as typeof fetch;

    await expect(fetchOfficialDraws(1201, fetcher)).resolves.toEqual([{
      drawNo: 1201,
      drawDate: '2025-12-06',
      numbers: [7, 9, 24, 27, 35, 36],
      bonus: 37,
    }]);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      'https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=1201',
    );
  });

  it('treats an official empty list as not published', async () => {
    const fetcher = (async () => new Response(JSON.stringify({
      resultCode: null,
      resultMessage: null,
      data: { list: [] },
    }), { status: 200 })) as typeof fetch;

    await expect(fetchOfficialDraws(1202, fetcher)).resolves.toEqual([]);
  });

  it('rejects a missing official list instead of treating it as no result', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ data: {} }), {
      status: 200,
    })) as typeof fetch;

    await expect(fetchOfficialDraws('all', fetcher)).rejects.toThrow();
  });

  it('rejects a non-success HTTP response', async () => {
    const fetcher = (async () => new Response('', { status: 503 })) as typeof fetch;

    await expect(fetchOfficialDraws(1202, fetcher)).rejects.toThrow('503');
  });
});
