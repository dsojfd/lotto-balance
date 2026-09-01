# Lotto Balance Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a public, installable lotto 6/45 PWA that updates validated official draw data, shows descriptive analysis, generates independent user-specific portfolios, and reports honest walk-forward backtests.

**Architecture:** A React/TypeScript PWA reads versioned static JSON produced by Node scripts. GitHub Actions is the only component that contacts the official Donghaeng Lottery site; the browser performs generation and local persistence without an application server. Pure domain modules own validation, analysis, generation, ranking, and backtesting so every statistical or physical invariant can be tested without UI or network state.

**Tech Stack:** Node.js 24, npm, React, TypeScript, Vite, Vitest, Testing Library, Playwright, vite-plugin-pwa, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-01-lotto-webapp-design.md`

## Global Constraints

- Host the production app as a public GitHub Pages PWA with no always-on server or database.
- Use only Donghaeng Lottery as the draw-data source; never silently substitute a third-party source.
- Analyze only completed draws through the latest validated draw.
- Expose `balanced` and `random` generation modes for 1, 5, or 10 games; default to 5 games.
- Use `crypto.getRandomValues()` for live recommendations and fail visibly when it is unavailable; never fall back to `Math.random()`.
- Never derive recommendations from a shared date, draw number, user identifier, or fixed seed; separate users and regeneration clicks consume independent browser entropy, so matching portfolios are possible but not deliberately synchronized.
- A generated portfolio must contain no duplicate combination.
- Historical number frequency and absence are descriptive only and must not become per-number predictive weights.
- A backtest target draw must never appear in its training data.
- Display `무작위 대비 우위 확인 안 됨` when observed differences remain inside the reported uncertainty interval.
- Preserve the last valid dataset and deployed Pages artifact whenever fetch, validation, tests, report generation, or build fails.
- Store user portfolios only on the current device; no accounts, analytics, ads, or cloud sync.
- Support app installation and last-valid-data offline use from 320px mobile width upward.
- Commit `package-lock.json` and use `npm ci` in automation.

---

## File Map

| Path | Responsibility |
|---|---|
| `package.json`, `package-lock.json` | Reproducible commands and dependencies |
| `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts` | TypeScript, build, unit-test, and browser-test configuration |
| `index.html`, `public/manifest.webmanifest`, `public/icons/*` | PWA entry and install metadata |
| `src/main.tsx`, `src/app/App.tsx`, `src/app/styles.css` | App bootstrap, tab shell, responsive product styling |
| `src/domain/draw.ts` | Draw and dataset types plus fail-closed validation |
| `src/domain/analysis.ts` | Windowed descriptive statistics and shape histograms |
| `src/domain/random.ts` | Secure and seeded integer random sources |
| `src/domain/generator.ts` | Uniform and balanced/diversified portfolio generation |
| `src/domain/backtest.ts` | Walk-forward slices, match counts, summaries, uncertainty |
| `src/domain/rank.ts` | Saved-combination result checking and prize-rank rules |
| `src/data/appData.ts` | Network-first dataset/report loading with last-valid fallback |
| `src/data/savedPortfolios.ts` | Versioned on-device portfolio persistence |
| `src/features/recommend/*` | Generator-first home screen and result cards |
| `src/features/analysis/*` | Analysis window selector and descriptive views |
| `src/features/verification/*` | Backtest comparison and limitation copy |
| `src/features/saved/*` | Saved portfolios, result matching, delete/copy/share |
| `src/ui/LottoBall.tsx`, `src/ui/StatusBanner.tsx` | Shared visual primitives |
| `scripts/officialClient.ts`, `scripts/updateDraws.ts` | Official internal JSON mapping and atomic dataset update |
| `scripts/buildReports.ts` | Deterministic analysis/backtest report generation |
| `public/data/draws.json` | Committed last-valid official dataset |
| `public/data/analysis.json`, `public/data/backtest.json` | Generated build inputs; not committed |
| `tests/fixtures/official-draw-1201.json` | Stable official-response contract fixture |
| `tests/e2e/app.spec.ts` | Mobile, offline, generation, save, and navigation checks |
| `.github/workflows/ci.yml` | Pull-request and push verification |
| `.github/workflows/pages.yml` | Scheduled/manual update, validation, commit, build, deploy |

---

### Task 1: Project Foundation and Test Harness

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/test/setup.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: none
- Produces: `npm run dev`, `npm run test`, `npm run typecheck`, `npm run build`, and a rendered `App`

- [ ] **Step 1: Install the runtime and test dependencies**

Run:

```powershell
npm init -y
npm install react react-dom
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @playwright/test vite-plugin-pwa tsx
```

Then set these exact scripts in `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Write the failing shell test**

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';

it('renders the Korean product name and four primary tabs', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '로또 밸런스' })).toBeVisible();
  for (const name of ['추천', '분석', '검증', '저장']) {
    expect(screen.getByRole('button', { name })).toBeVisible();
  }
});
```

- [ ] **Step 3: Run the test to verify the app shell is missing**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 4: Create the minimal Vite and React shell**

```tsx
// src/app/App.tsx
const tabs = ['추천', '분석', '검증', '저장'] as const;

export function App() {
  return (
    <main>
      <h1>로또 밸런스</h1>
      <nav aria-label="주요 메뉴">
        {tabs.map((tab) => <button key={tab} type="button">{tab}</button>)}
      </nav>
    </main>
  );
}
```

Configure `vite.config.ts` with `base: './'` so project Pages URLs do not require a known repository name, configure Vitest with `environment: 'jsdom'`, and bootstrap `App` from `src/main.tsx`.

- [ ] **Step 5: Verify the harness and production build**

Run:

```powershell
npm test -- src/app/App.test.tsx
npm run typecheck
npm run build
```

Expected: all commands exit 0 and `dist/index.html` exists.

- [ ] **Step 6: Commit the foundation**

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts index.html src .gitignore
git commit -m "chore: scaffold lotto PWA"
```

---

### Task 2: Draw Dataset Contract and Fail-Closed Validation

**Files:**
- Create: `src/domain/draw.ts`
- Create: `src/domain/draw.test.ts`
- Create: `public/data/draws.json`

**Interfaces:**
- Consumes: none
- Produces: `Draw`, `DrawDataset`, `parseDrawDataset(raw: unknown): DrawDataset`, `combinationKey(numbers: Combination): string`

- [ ] **Step 1: Write validation tests for a valid dataset and every blocking defect**

```ts
// src/domain/draw.test.ts
import { describe, expect, it } from 'vitest';
import { parseDrawDataset } from './draw';

const valid = {
  schemaVersion: 1,
  generatedAt: '2026-09-01T00:00:00.000Z',
  latestDraw: 2,
  sourceUrl: 'https://www.dhlottery.co.kr/lt645/result',
  draws: [
    { drawNo: 1, drawDate: '2002-12-07', numbers: [10, 23, 29, 33, 37, 40], bonus: 16 },
    { drawNo: 2, drawDate: '2002-12-14', numbers: [9, 13, 21, 25, 32, 42], bonus: 2 }
  ]
};

it('accepts a complete consecutive dataset', () => {
  expect(parseDrawDataset(valid).latestDraw).toBe(2);
});

it.each([
  ['duplicate number', { ...valid, draws: [{ ...valid.draws[0], numbers: [10, 10, 29, 33, 37, 40] }, valid.draws[1]] }],
  ['out of range', { ...valid, draws: [{ ...valid.draws[0], numbers: [0, 23, 29, 33, 37, 40] }, valid.draws[1]] }],
  ['bonus collision', { ...valid, draws: [{ ...valid.draws[0], bonus: 10 }, valid.draws[1]] }],
  ['draw gap', { ...valid, latestDraw: 3, draws: [valid.draws[0], { ...valid.draws[1], drawNo: 3 }] }]
])('rejects %s', (_name, raw) => expect(() => parseDrawDataset(raw)).toThrow());
```

- [ ] **Step 2: Run the tests to verify validation is absent**

Run: `npm test -- src/domain/draw.test.ts`

Expected: FAIL because `parseDrawDataset` is not defined.

- [ ] **Step 3: Implement the exact domain types and validator**

```ts
// src/domain/draw.ts
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

function validateDraw(raw: unknown, expectedDrawNo: number): Draw {
  if (!raw || typeof raw !== 'object') throw new Error(`${expectedDrawNo}회 데이터가 객체가 아닙니다.`);
  const value = raw as Partial<Draw>;
  if (value.drawNo !== expectedDrawNo || !Number.isInteger(value.drawNo)) throw new Error('회차가 올바르지 않습니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.drawDate ?? '')) throw new Error('추첨일 형식이 올바르지 않습니다.');
  if (!Array.isArray(value.numbers) || value.numbers.length !== 6) throw new Error('당첨번호는 6개여야 합니다.');
  if (value.numbers.some((number) => !Number.isInteger(number) || number < 1 || number > 45)) throw new Error('당첨번호 범위가 올바르지 않습니다.');
  if (new Set(value.numbers).size !== 6) throw new Error('당첨번호가 중복되었습니다.');
  if (value.numbers.some((number, index) => index > 0 && number <= value.numbers![index - 1])) throw new Error('당첨번호가 오름차순이 아닙니다.');
  if (!Number.isInteger(value.bonus) || value.bonus! < 1 || value.bonus! > 45 || value.numbers.includes(value.bonus!)) throw new Error('보너스 번호가 올바르지 않습니다.');
  return value as Draw;
}

export function parseDrawDataset(raw: unknown): DrawDataset {
  if (!raw || typeof raw !== 'object') throw new Error('데이터셋 객체가 아닙니다.');
  const data = raw as Partial<DrawDataset>;
  if (data.schemaVersion !== 1 || !Array.isArray(data.draws) || data.draws.length === 0) {
    throw new Error('지원하지 않는 데이터셋입니다.');
  }
  if (typeof data.generatedAt !== 'string' || Number.isNaN(Date.parse(data.generatedAt))) throw new Error('생성 시각이 올바르지 않습니다.');
  if (data.sourceUrl !== 'https://www.dhlottery.co.kr/lt645/result') throw new Error('공식 출처가 올바르지 않습니다.');
  const draws = data.draws.map((value, index) => validateDraw(value, index + 1));
  if (draws.some((draw, index) => draw.drawNo !== index + 1)) throw new Error('회차가 연속되지 않습니다.');
  if (data.latestDraw !== draws.at(-1)?.drawNo) throw new Error('최신 회차가 일치하지 않습니다.');
  return { ...data, draws } as DrawDataset;
}
```

- [ ] **Step 4: Run validation and type checks**

Run:

```powershell
npm test -- src/domain/draw.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Add a schema-valid one-draw bootstrap file**

Create `public/data/draws.json` with draw 1 and `latestDraw: 1`; Task 3 replaces it with the complete official history.

- [ ] **Step 6: Commit the contract**

```powershell
git add src/domain/draw.ts src/domain/draw.test.ts public/data/draws.json
git commit -m "feat: validate lotto draw datasets"
```

---

### Task 3: Official Draw Client and Atomic Dataset Update

**Files:**
- Create: `tests/fixtures/official-draw-1201.json`
- Create: `scripts/officialClient.ts`
- Create: `scripts/officialClient.test.ts`
- Create: `scripts/updateDraws.ts`
- Create: `scripts/updateDraws.test.ts`
- Modify: `package.json`
- Replace generated data: `public/data/draws.json`

**Interfaces:**
- Consumes: `Draw`, `DrawDataset`, `parseDrawDataset`
- Produces: `mapOfficialRecord(raw: unknown): Draw`, `mergeOfficialDraws(existing: DrawDataset, incoming: Draw[]): DrawDataset`, `fetchOfficialDraws(query: 'all' | number): Promise<Draw[]>`

- [ ] **Step 1: Add an exact official-response fixture**

```json
{
  "resultCode": null,
  "resultMessage": null,
  "data": {
    "list": [{
      "ltEpsd": 1201,
      "tm1WnNo": 7,
      "tm2WnNo": 9,
      "tm3WnNo": 24,
      "tm4WnNo": 27,
      "tm5WnNo": 35,
      "tm6WnNo": 36,
      "bnsWnNo": 37,
      "ltRflYmd": "20251206"
    }]
  }
}
```

- [ ] **Step 2: Write failing mapping, merge, no-result, and gap tests**

```ts
// scripts/officialClient.test.ts
import fixture from '../tests/fixtures/official-draw-1201.json';
import { expect, it } from 'vitest';
import { mapOfficialRecord } from './officialClient';

it('maps the official field names without guessing', () => {
  expect(mapOfficialRecord(fixture.data.list[0])).toEqual({
    drawNo: 1201,
    drawDate: '2025-12-06',
    numbers: [7, 9, 24, 27, 35, 36],
    bonus: 37
  });
});
```

In `scripts/updateDraws.test.ts`, assert that an empty official list returns unchanged data, the exact next draw is appended, a gap throws, and malformed records leave the original serialized file unchanged.

- [ ] **Step 3: Run the updater tests to verify they fail**

Run: `npm test -- scripts/officialClient.test.ts scripts/updateDraws.test.ts`

Expected: FAIL because the client and updater do not exist.

- [ ] **Step 4: Implement the official JSON client**

```ts
// scripts/officialClient.ts
import type { Draw } from '../src/domain/draw';

const BASE_URL = 'https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do';

export function mapOfficialRecord(raw: unknown): Draw {
  const item = raw as Record<string, unknown>;
  const date = String(item.ltRflYmd);
  return {
    drawNo: Number(item.ltEpsd),
    drawDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    numbers: [1, 2, 3, 4, 5, 6].map((n) => Number(item[`tm${n}WnNo`])) as unknown as Draw['numbers'],
    bonus: Number(item.bnsWnNo)
  };
}

export async function fetchOfficialDraws(query: 'all' | number): Promise<Draw[]> {
  const url = `${BASE_URL}?srchLtEpsd=${query}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'application/json',
      Referer: 'https://www.dhlottery.co.kr/lt645/result',
      'User-Agent': 'lotto-balance-updater/1.0',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  if (!response.ok) throw new Error(`공식 데이터 요청 실패: ${response.status}`);
  const body = await response.json() as { data?: { list?: unknown[] } };
  return (body.data?.list ?? []).map(mapOfficialRecord);
}
```

Validate every mapped `Draw` through the Task 2 contract before accepting it. Treat an empty list as “not published,” not as a fabricated draw.

- [ ] **Step 5: Implement merge and atomic write**

`mergeOfficialDraws` must sort by `drawNo`, reject conflicting duplicates, require a complete 1..latest sequence, preserve the official result URL, and call `parseDrawDataset` on the final object. In update mode, start at `latestDraw + 1`, require every non-empty response to contain that exact draw, and continue one draw at a time until the official endpoint returns an empty list; cap one run at 60 appended draws and fail instead of silently remaining stale if the cap is reached. `updateDraws.ts` must write JSON to `public/data/draws.json.tmp`, validate the temp content, then rename it over `public/data/draws.json`; remove the temp file on any exception.

Add scripts:

```json
{
  "data:bootstrap": "tsx scripts/updateDraws.ts --bootstrap",
  "data:update": "tsx scripts/updateDraws.ts"
}
```

- [ ] **Step 6: Run isolated updater tests**

Run:

```powershell
npm test -- scripts/officialClient.test.ts scripts/updateDraws.test.ts
npm run typecheck
```

Expected: PASS with no network request from tests.

- [ ] **Step 7: Bootstrap and independently validate the complete official history**

Run: `npm run data:bootstrap`

Expected: `public/data/draws.json` contains a consecutive sequence beginning at draw 1 and ending at the newest result returned by Donghaeng Lottery. Then run:

```powershell
npm test -- src/domain/draw.test.ts scripts/officialClient.test.ts scripts/updateDraws.test.ts
npm run typecheck
```

Expected: PASS. If the live internal endpoint has changed, stop here and update the fixture/client from the official result page; do not use a third-party dataset.

- [ ] **Step 8: Commit the validated dataset pipeline**

```powershell
git add package.json package-lock.json scripts tests/fixtures public/data/draws.json
git commit -m "feat: update validated official draws"
```

---

### Task 4: Descriptive Analysis Engine

**Files:**
- Create: `src/domain/analysis.ts`
- Create: `src/domain/analysis.test.ts`

**Interfaces:**
- Consumes: `Draw[]`, `Combination`
- Produces: `AnalysisWindow`, `AnalysisReport`, `analyzeDraws(draws: Draw[]): AnalysisReport`, `extractShape(numbers: Combination): Shape`

- [ ] **Step 1: Write failing tests for windowing, number gaps, shapes, and pairs**

```ts
// src/domain/analysis.test.ts
import { expect, it } from 'vitest';
import { analyzeDraws } from './analysis';

const draws = [
  { drawNo: 1, drawDate: '2002-12-07', numbers: [1, 2, 3, 10, 20, 45] as const, bonus: 9 },
  { drawNo: 2, drawDate: '2002-12-14', numbers: [1, 7, 14, 21, 28, 35] as const, bonus: 2 }
];

it('computes descriptive frequency, absence, and pair counts', () => {
  const report = analyzeDraws(draws);
  expect(report.windows.all.drawCount).toBe(2);
  expect(report.windows.all.numbers[0]).toMatchObject({ number: 1, appearances: 2, absence: 0 });
  expect(report.windows.all.numbers[44]).toMatchObject({ number: 45, appearances: 1, absence: 1 });
  expect(report.windows.all.pairCounts['1-2']).toBe(1);
});
```

Add tests for odd count, low/high count, five fixed sections, sum, range, adjacent pairs, duplicate endings, and previous-draw reuse.

- [ ] **Step 2: Run analysis tests to verify failure**

Run: `npm test -- src/domain/analysis.test.ts`

Expected: FAIL because `analyzeDraws` is missing.

- [ ] **Step 3: Implement explicit analysis types and histograms**

```ts
export type WindowName = 'all' | '10' | '30' | '50' | '100';

export interface Shape {
  oddCount: number;
  lowCount: number;
  sum: number;
  range: number;
  sectionCount: number;
  adjacentPairs: number;
  duplicateEndings: number;
}

export interface NumberAnalysis {
  number: number;
  appearances: number;
  expected: number;
  delta: number;
  absence: number;
}

export interface AnalysisWindow {
  drawCount: number;
  numbers: NumberAnalysis[];
  shapeHistograms: Record<keyof Shape, Record<string, number>>;
  pairCounts: Record<string, number>;
  previousDrawReuse: Record<string, number>;
}
```

`analyzeDraws` must slice the last N draws for each window, calculate expected appearances as `drawCount * 6 / 45`, and never emit a predictive weight.

- [ ] **Step 4: Verify analysis behavior**

Run:

```powershell
npm test -- src/domain/analysis.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the analysis engine**

```powershell
git add src/domain/analysis.ts src/domain/analysis.test.ts
git commit -m "feat: compute descriptive lotto analysis"
```

---

### Task 5: Secure Uniform Generator

**Files:**
- Create: `src/domain/random.ts`
- Create: `src/domain/random.test.ts`
- Create: `src/domain/generator.ts`
- Create: `src/domain/generator.random.test.ts`

**Interfaces:**
- Consumes: `Combination`, `combinationKey`
- Produces: `RandomSource`, `CryptoRandomSource`, `SeededRandomSource`, `drawUniformCombination(source: RandomSource): Combination`, `generateRandomPortfolio(count: 1 | 5 | 10, source: RandomSource): Combination[]`

- [ ] **Step 1: Write failing deterministic and invariant tests**

```ts
import { expect, it } from 'vitest';
import { drawUniformCombination, generateRandomPortfolio } from './generator';
import { SeededRandomSource } from './random';

it('draws six sorted unique in-range numbers', () => {
  const result = drawUniformCombination(new SeededRandomSource(12345));
  expect(result).toHaveLength(6);
  expect([...new Set(result)]).toHaveLength(6);
  expect(result).toEqual([...result].sort((a, b) => a - b));
  expect(result.every((n) => n >= 1 && n <= 45)).toBe(true);
});

it('never returns a duplicate combination in a portfolio', () => {
  const portfolio = generateRandomPortfolio(10, new SeededRandomSource(7));
  expect(new Set(portfolio.map((numbers) => numbers.join('-'))).size).toBe(10);
});

it('consumes fresh source values for consecutive portfolios', () => {
  const source = new SeededRandomSource(99);
  expect(generateRandomPortfolio(5, source)).not.toEqual(generateRandomPortfolio(5, source));
});
```

- [ ] **Step 2: Run generator tests to verify failure**

Run: `npm test -- src/domain/random.test.ts src/domain/generator.random.test.ts`

Expected: FAIL because the random sources and generator are missing.

- [ ] **Step 3: Implement unbiased bounded integers**

```ts
export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export class CryptoRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    if (!globalThis.crypto?.getRandomValues) throw new Error('안전한 난수를 사용할 수 없습니다.');
    const range = 0x1_0000_0000;
    const limit = Math.floor(range / maxExclusive) * maxExclusive;
    const value = new Uint32Array(1);
    do globalThis.crypto.getRandomValues(value); while (value[0] >= limit);
    return value[0] % maxExclusive;
  }
}
```

Implement `SeededRandomSource` with a documented Mulberry32 state transition for tests and backtests only. Do not expose it to live recommendations.

- [ ] **Step 4: Implement uniform sampling without replacement**

Build `[1..45]`, perform the first six steps of a Fisher–Yates shuffle with `source.nextInt(45 - index)`, take six numbers, and sort ascending. Build portfolios with a `Set` of `combinationKey` values.

- [ ] **Step 5: Verify invariants and type safety**

Run:

```powershell
npm test -- src/domain/random.test.ts src/domain/generator.random.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the uniform generator**

```powershell
git add src/domain/random.ts src/domain/random.test.ts src/domain/generator.ts src/domain/generator.random.test.ts
git commit -m "feat: generate secure uniform portfolios"
```

---

### Task 6: Balanced and Diversified Generator

**Files:**
- Modify: `src/domain/generator.ts`
- Create: `src/domain/generator.balanced.test.ts`

**Interfaces:**
- Consumes: `Draw[]`, `Shape`, `extractShape`, `RandomSource`, `drawUniformCombination`
- Produces: `ShapeModel`, `buildShapeModel(draws: Draw[]): ShapeModel`, `scoreCombination(numbers: Combination, model: ShapeModel, avoidPopular: boolean): number`, `generateBalancedPortfolio(count, draws, source, options): Combination[]`

- [ ] **Step 1: Write failing scoring and diversity tests**

```ts
it('uses common shape buckets but not individual number frequency', () => {
  const model = buildShapeModel(trainingDraws);
  const first = scoreCombination([1, 8, 15, 22, 29, 36], model, false);
  const renumbered = scoreCombination([2, 9, 16, 23, 30, 37], model, false);
  expect(first).toBe(renumbered);
});

it('selects a less-overlapping candidate when shape scores tie', () => {
  const selected = selectDiverseCandidates(
    [[1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 7, 8], [9, 10, 11, 12, 13, 14]],
    2,
    () => 1
  );
  expect(selected).toEqual([[1, 2, 3, 4, 5, 6], [9, 10, 11, 12, 13, 14]]);
});
```

Also assert 1/5/10 output sizes, no identical combination, valid numbers, and deterministic seeded output.

- [ ] **Step 2: Run balanced tests to verify failure**

Run: `npm test -- src/domain/generator.balanced.test.ts`

Expected: FAIL because balanced scoring is missing.

- [ ] **Step 3: Implement the shape model and honest score**

For each `Shape` field, build a histogram from training draws. For a candidate value, calculate `bucketCount / largestBucketCount`; average the seven field scores to get `shapeScore` in 0..1. Do not read number frequency, number absence, or pair frequency in `scoreCombination`.

When `avoidPopular` is enabled, multiply the score by `0.8` when all six values are <=31, by `0.7` for six consecutive numbers, and by `0.9` when three or more numbers share an ending digit. Display this as an optional popularity heuristic, not as a probability gain.

- [ ] **Step 4: Implement diversified portfolio selection**

Generate `max(2500, count * 500)` unique uniform candidates. Pick the highest `shapeScore` first. For each remaining pick calculate:

```ts
const diversityScore = 1 - Math.max(...selected.map((line) => overlap(candidate, line))) / 6;
const finalScore = 0.7 * shapeScore + 0.3 * diversityScore;
```

Select the highest `finalScore`, using `combinationKey` as a stable final tie-breaker. This makes the behavior auditable and prevents hidden hot/cold weighting.

- [ ] **Step 5: Verify balanced generation**

Run:

```powershell
npm test -- src/domain/generator.random.test.ts src/domain/generator.balanced.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the balanced generator**

```powershell
git add src/domain/generator.ts src/domain/generator.balanced.test.ts
git commit -m "feat: add balanced diversified portfolios"
```

---

### Task 7: Walk-Forward Backtest and Generated Reports

**Files:**
- Create: `src/domain/backtest.ts`
- Create: `src/domain/backtest.test.ts`
- Create: `scripts/buildReports.ts`
- Create: `scripts/buildReports.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `Draw[]`, `analyzeDraws`, both portfolio generators, `SeededRandomSource`
- Produces: `BacktestConfig`, `BacktestReport`, `createWalkForwardSlices(draws, minimumTrainingDraws)`, `runBacktest(draws, config)`, generated `analysis.json` and `backtest.json`

- [ ] **Step 1: Write the future-leak and match-count tests**

```ts
it('excludes the target draw from every training slice', () => {
  const slices = createWalkForwardSlices(draws, 2);
  expect(slices[0].training.map((draw) => draw.drawNo)).toEqual([1, 2]);
  expect(slices[0].target.drawNo).toBe(3);
});

it('counts main and bonus matches separately', () => {
  expect(matchCombination([1, 2, 3, 4, 5, 9], {
    drawNo: 4, drawDate: '2002-12-28', numbers: [1, 2, 3, 4, 5, 6], bonus: 9
  })).toEqual({ main: 5, bonus: true });
});
```

Add a deterministic repeat test that calls `runBacktest` twice with the same seed and compares the entire report.

- [ ] **Step 2: Run backtest tests to verify failure**

Run: `npm test -- src/domain/backtest.test.ts scripts/buildReports.test.ts`

Expected: FAIL because the backtest and report builder are missing.

- [ ] **Step 3: Implement the walk-forward comparison**

Use this default configuration:

```ts
export const DEFAULT_BACKTEST_CONFIG = {
  minimumTrainingDraws: 100,
  gamesPerPortfolio: 5,
  portfoliosPerTarget: 20,
  seed: 0x6452026
} as const;
```

For every target draw after the first 100 draws, build the shape model only from preceding draws, generate the same number of balanced and random portfolios from separate seeded streams, and accumulate 0..6 main-match counts. Use bootstrap resampling over target draws to produce a 95% interval for the mean-match difference. Set the Korean conclusion to `무작위 대비 우위 확인 안 됨` whenever the interval includes zero.

- [ ] **Step 4: Implement deterministic report generation**

`scripts/buildReports.ts` must read and validate `public/data/draws.json`, write `public/data/analysis.json` and `public/data/backtest.json` through temp-file-plus-rename, and include `schemaVersion`, `latestDraw`, config, generated timestamp, metrics, interval, and conclusion.

Add:

```json
{
  "scripts": {
    "reports:build": "tsx scripts/buildReports.ts"
  }
}
```

Add the two generated report files to `.gitignore`; they are deployment artifacts derived from committed draws.

- [ ] **Step 5: Verify reports from fixture and full data**

Run:

```powershell
npm test -- src/domain/backtest.test.ts scripts/buildReports.test.ts
npm run reports:build
npm run typecheck
```

Expected: PASS and both JSON reports validate against their exported TypeScript report types.

- [ ] **Step 6: Commit backtesting and report generation**

```powershell
git add src/domain/backtest.ts src/domain/backtest.test.ts scripts/buildReports.ts scripts/buildReports.test.ts package.json package-lock.json .gitignore
git commit -m "feat: add walk-forward comparison reports"
```

---

### Task 8: Runtime Data Loading, Saved Portfolios, and Rank Checking

**Files:**
- Create: `src/data/appData.ts`
- Create: `src/data/appData.test.ts`
- Create: `src/data/savedPortfolios.ts`
- Create: `src/data/savedPortfolios.test.ts`
- Create: `src/domain/rank.ts`
- Create: `src/domain/rank.test.ts`

**Interfaces:**
- Consumes: validated dataset/report types, `Combination`, `Draw`
- Produces: `loadAppData(): Promise<AppDataState>`, `SavedPortfolio`, `SavedPortfolioStore`, `checkCombination(numbers, draw): CheckedResult`

- [ ] **Step 1: Write network/fallback and storage tests**

```ts
it('keeps the last valid dataset when the network payload is invalid', async () => {
  localStorage.setItem('lotto.dataset.v1', JSON.stringify(validDataset));
  const state = await loadAppData(async () => new Response('{"bad":true}'));
  expect(state.dataset.latestDraw).toBe(validDataset.latestDraw);
  expect(state.isOfflineFallback).toBe(true);
});

it('does not delete saved portfolios when public data is corrupt', () => {
  const store = new SavedPortfolioStore(localStorage);
  store.save(savedPortfolio);
  expect(store.list()).toEqual([savedPortfolio]);
});
```

- [ ] **Step 2: Write prize-rank truth-table tests**

Cover: 6 main = rank 1; 5 main + bonus = 2; 5 main = 3; 4 main = 4; 3 main = 5; all other cases = null.

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- src/data src/domain/rank.test.ts`

Expected: FAIL because loaders, store, and checker are missing.

- [ ] **Step 4: Implement network-first last-valid loading**

Fetch `/data/draws.json`, `/data/analysis.json`, and `/data/backtest.json` with `{ cache: 'no-store' }`. Validate before storing each successful payload under `lotto.dataset.v1`, `lotto.analysis.v1`, and `lotto.backtest.v1`. If any fetch or validation fails, use only a previously validated cached value and return `isOfflineFallback: true`; throw a Korean blocking error if neither source is valid.

- [ ] **Step 5: Implement versioned saved portfolios and rank checking**

```ts
export interface SavedPortfolio {
  id: string;
  schemaVersion: 1;
  targetDrawNo: number;
  mode: 'balanced' | 'random';
  createdAt: string;
  combinations: Combination[];
}
```

Use one key, `lotto.saved-portfolios.v1`. Parse and validate saved values without touching the public dataset keys. `checkCombination` must return `{ mainMatches, bonusMatched, rank }` from the tested truth table.

- [ ] **Step 6: Verify data and persistence behavior**

Run:

```powershell
npm test -- src/data src/domain/rank.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit runtime data services**

```powershell
git add src/data src/domain/rank.ts src/domain/rank.test.ts
git commit -m "feat: persist and check saved portfolios"
```

---

### Task 9: Generator-First App Shell and Recommendation Screen

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/App.integration.test.tsx`
- Create: `src/app/styles.css`
- Create: `src/features/recommend/RecommendScreen.tsx`
- Create: `src/features/recommend/RecommendScreen.test.tsx`
- Create: `src/features/recommend/PortfolioView.tsx`
- Create: `src/ui/LottoBall.tsx`
- Create: `src/ui/StatusBanner.tsx`

**Interfaces:**
- Consumes: `AppDataState`, `CryptoRandomSource`, both generators, `SavedPortfolioStore`
- Produces: accessible recommendation UI and tab shell matching approved layout A

- [ ] **Step 1: Write the generator-first interaction test**

```tsx
it('defaults to five balanced games and regenerates on demand', async () => {
  const user = userEvent.setup();
  const source = new SeededRandomSource(42);
  render(<RecommendScreen dataset={validDataset} randomSourceFactory={() => source} />);
  expect(screen.getByRole('button', { name: '5게임' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '균형·분산 추천' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: '추천번호 생성' }));
  expect(screen.getAllByLabelText(/추천 조합/)).toHaveLength(5);
});
```

Add tests for 1/10 games, random mode, no duplicate cards, a changed portfolio after a second generation click with the continuing seeded source, latest draw label, the exact equal-probability disclosure, generation error, and save-all.

- [ ] **Step 2: Run the recommendation tests to verify failure**

Run: `npm test -- src/features/recommend src/app/App.integration.test.tsx`

Expected: FAIL because the screen components are missing.

- [ ] **Step 3: Implement the approved A layout**

`RecommendScreen` owns `mode: 'balanced' | 'random'`, `gameCount: 1 | 5 | 10`, `avoidPopular: boolean`, and the current portfolio. Accept `randomSourceFactory: () => RandomSource` as an optional test seam whose production default is `() => new CryptoRandomSource()`; invoke the factory once for each portfolio generation and call the selected generator. `PortfolioView` renders sorted balls plus odd/even, sum, and adjacent-pair descriptions from `extractShape`.

`App` loads `AppDataState`, displays `제N회 기준 · 갱신 시각`, and renders four bottom tab buttons. Keep analysis explanations behind `추천 기준 자세히 보기` instead of crowding the home screen.

Show this probability contract near the result without suggesting optimization: `모든 고정 조합의 1등 확률은 동일합니다 (1/8,145,060)`. Label balanced output as `조합 형태 점수`, and explain that lower overlap/popularity heuristics alter portfolio composition, not the probability of any selected line.

- [ ] **Step 4: Implement mobile-first product styling**

Use CSS custom properties for light/dark colors, touch targets at least 44px, one-column content at 320px, a centered max-width content column on desktop, fixed range colors for number balls with text labels, and a bottom navigation that does not cover page content. Do not rely on color alone for selected state.

- [ ] **Step 5: Verify recommendation UI and build**

Run:

```powershell
npm test -- src/features/recommend src/app
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the recommendation screen**

```powershell
git add src/app src/features/recommend src/ui
git commit -m "feat: add generator-first recommendation UI"
```

---

### Task 10: Analysis and Verification Screens

**Files:**
- Create: `src/features/analysis/AnalysisScreen.tsx`
- Create: `src/features/analysis/AnalysisScreen.test.tsx`
- Create: `src/features/verification/VerificationScreen.tsx`
- Create: `src/features/verification/VerificationScreen.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: generated `AnalysisReport` and `BacktestReport`
- Produces: analysis window selection and honest backtest comparison screens

- [ ] **Step 1: Write failing analysis-view tests**

Assert that `전체`, `최근 10회`, `최근 30회`, `최근 50회`, and `최근 100회` controls change the visible draw count; number frequency and absence are displayed; pair counts include sample size; and the sentence `다음 회차 당첨확률 예측이 아닙니다` is always visible.

- [ ] **Step 2: Write failing verification-view tests**

```tsx
it('shows inputs, uncertainty, and the fail-closed conclusion', () => {
  render(<VerificationScreen report={reportIncludingZero} />);
  expect(screen.getByText('게임 수 5')).toBeVisible();
  expect(screen.getByText('반복 수 20')).toBeVisible();
  expect(screen.getByText(/95% 구간/)).toBeVisible();
  expect(screen.getByText('무작위 대비 우위 확인 안 됨')).toBeVisible();
});
```

- [ ] **Step 3: Run the screen tests to verify failure**

Run: `npm test -- src/features/analysis src/features/verification`

Expected: FAIL because both screens are missing.

- [ ] **Step 4: Implement compact descriptive views**

Use a 1..45 grid for number appearance/absence, small accessible bars for odd/low/section histograms, and a sorted pair list. Display values and sample sizes; do not label numbers hot, cold, likely, or overdue.

- [ ] **Step 5: Implement the verification comparison**

Display evaluation draw count, games per portfolio, repetitions, seed, 0..6 match distribution, mean matches, balanced-minus-random interval, and the report’s Korean conclusion. The screen must not compute a new conclusion from rounded display values.

- [ ] **Step 6: Verify analysis, verification, and build**

Run:

```powershell
npm test -- src/features/analysis src/features/verification src/app
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit both screens**

```powershell
git add src/features/analysis src/features/verification src/app
git commit -m "feat: show analysis and backtest evidence"
```

---

### Task 11: Saved Screen, Sharing, Install Metadata, and Offline Behavior

**Files:**
- Create: `src/features/saved/SavedScreen.tsx`
- Create: `src/features/saved/SavedScreen.test.tsx`
- Create: `src/features/saved/sharePortfolio.ts`
- Create: `src/features/saved/sharePortfolio.test.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Modify: `vite.config.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `SavedPortfolioStore`, `checkCombination`, `DrawDataset`
- Produces: result-grouped saved list, Web Share with clipboard fallback, installable offline PWA

- [ ] **Step 1: Write saved-result and deletion tests**

Assert portfolios group by `targetDrawNo`, completed targets show main/bonus matches and rank, future targets show `추첨 전`, deleting one portfolio leaves all others intact, and no public dataset key is removed.

- [ ] **Step 2: Write sharing fallback tests**

```ts
it('uses clipboard when Web Share is unavailable', async () => {
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  await sharePortfolio(savedPortfolio, { share: undefined, clipboard });
  expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('로또 밸런스'));
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- src/features/saved`

Expected: FAIL because the screen and share helper are missing.

- [ ] **Step 4: Implement saved, checked, delete, copy, and share flows**

Build Korean share text containing target draw, mode, creation time, and one line per combination. Call `navigator.share({ title, text })` when available; otherwise call `navigator.clipboard.writeText(text)` and display `복사했습니다`. Require an explicit user click before deletion and delete only the selected saved ID.

- [ ] **Step 5: Configure PWA and offline caches**

Use `VitePWA` with `registerType: 'autoUpdate'`, app-shell precaching, and a runtime `NetworkFirst` rule matching `/\/data\/.*\.json$/`. Keep a bounded number of validated data responses but do not use a time-based expiry: the last cached response must remain available through an arbitrarily long network outage until a newer validated response replaces it. Set manifest name `로또 밸런스`, short name `로또`, `display: 'standalone'`, and start URL `./`.

Create simple source-controlled 192px and 512px app icons with a numbered-ball mark; verify they are real PNGs at exact dimensions.

- [ ] **Step 6: Verify saved flows and PWA build**

Run:

```powershell
npm test -- src/features/saved src/app
npm run typecheck
npm run reports:build
npm run build
```

Expected: PASS; `dist/manifest.webmanifest` and a generated service worker exist.

- [ ] **Step 7: Commit saved and offline features**

```powershell
git add src/features/saved src/app vite.config.ts public/manifest.webmanifest public/icons
git commit -m "feat: add saved results sharing and offline PWA"
```

---

### Task 12: End-to-End Verification and GitHub Pages Automation

**Files:**
- Create: `tests/e2e/app.spec.ts`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/pages.yml`
- Modify: `playwright.config.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: all prior tasks and npm scripts
- Produces: evidence-backed responsive/offline workflow and automatic validated Pages deployment

- [ ] **Step 1: Write the end-to-end user journey before final automation**

```ts
test('mobile user generates, saves, and reopens five games', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('./');
  await page.getByRole('button', { name: '추천번호 생성' }).click();
  await expect(page.getByLabel(/추천 조합/)).toHaveCount(5);
  await page.getByRole('button', { name: '전체 저장' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText(/5게임/)).toBeVisible();
});
```

Add journeys for 320px no-horizontal-overflow, 10-game random generation, analysis window switching, verification conclusion, reload persistence, invalid-network fallback, and a service-worker offline reload after one online visit.

- [ ] **Step 2: Run E2E tests to reveal remaining integration defects**

Run:

```powershell
npx playwright install chromium
npm run reports:build
npm run build
npm run e2e
```

Expected: initial failures identify missing selectors or offline integration defects; fix product code, not the approved assertions.

- [ ] **Step 3: Create the CI workflow**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm test
      - run: npm run reports:build
      - run: npm run build
      - run: npm run e2e
```

- [ ] **Step 4: Create the scheduled/manual Pages workflow**

```yaml
name: Update data and deploy Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
  schedule:
    - cron: '17 22 * * 6'
    - cron: '17 6 * * 0'
permissions:
  contents: write
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Update official draw data
        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
        run: npm run data:update
      - name: Commit a validated new draw
        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
        run: |
          if git diff --quiet -- public/data/draws.json; then exit 0; fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/data/draws.json
          git commit -m "data: update official lotto draw"
          git push
      - run: npm test
      - run: npm run reports:build
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

GitHub Actions cron expressions are UTC: these runs correspond to Sunday 07:17 and 15:17 KST. Keeping two post-draw attempts handles delayed publication without inventing data.

- [ ] **Step 5: Document exact local and GitHub setup**

`README.md` must include: Node 24 installation, `npm ci`, `npm run data:bootstrap`, `npm run reports:build`, `npm run dev`, full verification commands, GitHub repository creation/push, Settings → Pages → Source = GitHub Actions, manual workflow run, PWA home-screen installation, offline behavior, local-only saved data, and the equal-probability disclaimer.

- [ ] **Step 6: Run the complete release gate locally**

Run:

```powershell
npm ci
npm test
npm run reports:build
npm run typecheck
npm run build
npm run e2e
git diff --check
git status --short
```

Expected: every command exits 0. `git status --short` contains only the intended Task 12 files before commit; generated analysis/backtest files remain ignored.

- [ ] **Step 7: Commit automation and documentation**

```powershell
git add tests/e2e playwright.config.ts .github README.md
git commit -m "ci: verify and deploy lotto PWA"
```

- [ ] **Step 8: Verify the first GitHub deployment after push**

After the user supplies or selects the GitHub repository, push `main`, enable GitHub Actions as the Pages source, manually run `Update data and deploy Pages`, and verify:

```text
CI: green
Update data and deploy Pages: green
Published page: loads latest validated draw
Mobile 360px: no horizontal overflow
Offline reload: last validated draw remains usable
Saved portfolio: remains after reload and is checked after a newer draw arrives
```

Do not claim production completion until those live checks pass.

---

## Final Review Checklist

- [ ] Every spec requirement maps to a task above.
- [ ] No future draw enters any backtest training slice.
- [ ] Live generation never uses seeded or `Math.random()` sources.
- [ ] Balanced scoring never reads number frequency, absence, or pair frequency.
- [ ] Invalid official data cannot replace `draws.json` or the prior Pages deployment.
- [ ] The app explains equal combination probability and backtest uncertainty.
- [ ] 1, 5, and 10 game portfolios are valid and internally unique.
- [ ] Last-valid offline mode and device-only persistence work at 320px and 360px.
- [ ] GitHub Pages deployment and scheduled/manual refresh are verified live.
