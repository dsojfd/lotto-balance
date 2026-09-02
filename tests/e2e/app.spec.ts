import { expect, test, type Page } from '@playwright/test';

async function openApp(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '로또 밸런스' })).toBeVisible();
  await expect(page.getByText(/제\d+회 기준/)).toBeVisible();
}

async function generateAndSaveFiveGames(page: Page): Promise<void> {
  await page.getByRole('button', { name: '5게임' }).click();
  await page.getByRole('button', { name: '추천번호 생성' }).click();
  await expect(page.locator('[aria-label^="추천 조합 "]')).toHaveCount(5);
  await page.getByRole('button', { name: '전체 저장' }).click();
  await expect(page.getByText('추천 조합을 저장했습니다.')).toBeVisible();
}

test('mobile user generates, saves, and reopens five games', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openApp(page);
  await generateAndSaveFiveGames(page);

  await page.getByRole('tab', { name: '저장' }).click();
  const savedRecord = page.getByRole('article', { name: /저장 기록/ });
  await expect(savedRecord).toBeVisible();
  await expect(savedRecord.getByRole('listitem')).toHaveCount(5);

  await page.getByRole('tab', { name: '추천' }).click();
  await page.getByRole('tab', { name: '저장' }).click();
  await expect(page.getByRole('article', { name: /저장 기록/ })).toBeVisible();
});

test('saved actions keep a minimum 44px touch target', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openApp(page);
  await generateAndSaveFiveGames(page);
  await page.getByRole('tab', { name: '저장' }).click();

  const record = page.getByRole('article', { name: /저장 기록/ });
  for (const name of ['공유', '복사', /삭제/]) {
    const box = await record.getByRole('button', { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('all main screens fit without horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openApp(page);
  await page.getByRole('button', { name: '무작위 추천' }).click();
  await page.getByRole('button', { name: '10게임' }).click();
  await page.getByRole('button', { name: '추천번호 생성' }).click();
  await expect(page.locator('[aria-label^="추천 조합 "]')).toHaveCount(10);

  for (const tab of ['추천', '분석', '예상게임', '저장']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    if (tab === '예상게임') {
      await page.getByRole('button', { name: '완전 랜덤' }).click();
      await page.getByRole('button', { name: '500게임' }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('button', { name: '게임번호 생성' }).click();
      await expect(page.locator('[aria-label^="가상 구매 조합 "]')).toHaveCount(500);
      await page.getByRole('button', { name: '추첨 시작' }).click();
      await expect(page.getByRole('heading', { name: '가상 당첨번호' })).toBeVisible();
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('expected game counts form four aligned columns across two mobile rows', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openApp(page);
  await page.getByRole('tab', { name: '예상게임' }).click();

  const buttons = page.getByRole('group', { name: '게임 수' }).getByRole('button');
  await expect(buttons).toHaveCount(8);
  const boxes = await Promise.all(
    Array.from({ length: 8 }, (_, index) => buttons.nth(index).boundingBox()),
  );
  const visibleBoxes = boxes.filter((box): box is NonNullable<typeof box> => box !== null);
  expect(visibleBoxes).toHaveLength(8);
  const firstRow = visibleBoxes.slice(0, 4);
  const secondRow = visibleBoxes.slice(4);

  expect(new Set(firstRow.map((box) => box.y))).toHaveProperty('size', 1);
  expect(new Set(secondRow.map((box) => box.y))).toHaveProperty('size', 1);
  expect(secondRow[0].y).toBeGreaterThan(firstRow[0].y);
  expect(firstRow.map((box) => box.x)).toEqual(secondRow.map((box) => box.x));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('five hundred analysis games do not repeatedly block the main thread', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openApp(page);
  await page.getByRole('tab', { name: '예상게임' }).click();
  await page.getByRole('button', { name: '500게임' }).click();
  await page.evaluate(() => {
    const durations: number[] = [];
    Object.assign(window, { __simulationLongTasks: durations });
    new PerformanceObserver((list) => {
      durations.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: 'longtask', buffered: true });
  });

  await page.getByRole('button', { name: '게임번호 생성' }).click();
  await expect(page.locator('[aria-label^="가상 구매 조합 "]')).toHaveCount(500, { timeout: 30000 });
  const repeatedLongTasks = await page.evaluate(() => (
    (window as Window & { __simulationLongTasks: number[] }).__simulationLongTasks
      .filter((duration) => duration >= 80).length
  ));

  expect(repeatedLongTasks).toBeLessThan(3);
});

test('user generates ten games with the random method', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '무작위 추천' }).click();
  await page.getByRole('button', { name: '10게임' }).click();
  await page.getByRole('button', { name: '추천번호 생성' }).click();

  await expect(page.getByRole('heading', { name: '무작위 추천 결과' })).toBeVisible();
  await expect(page.locator('[aria-label^="추천 조합 "]')).toHaveCount(10);
});

test('user switches the analysis window', async ({ page }) => {
  await openApp(page);
  await page.getByRole('tab', { name: '분석' }).click();
  await page.getByRole('button', { name: '최근 10회' }).click();

  await expect(page.getByRole('button', { name: '최근 10회' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('집계 회차 10회')).toBeVisible();
});

test('user generates games before revealing a virtual draw', async ({ page }) => {
  await openApp(page);
  await page.getByRole('tab', { name: '예상게임' }).click();
  await page.getByRole('button', { name: '완전 랜덤' }).click();
  await page.getByRole('button', { name: '20게임' }).click();
  await page.getByRole('button', { name: '게임번호 생성' }).click();

  await expect(page.locator('[aria-label^="가상 구매 조합 "]')).toHaveCount(20);
  await expect(page.getByRole('heading', { name: '가상 당첨번호' })).toHaveCount(0);
  await page.getByRole('button', { name: '추첨 시작' }).click();
  await expect(page.getByRole('heading', { name: '가상 당첨번호' })).toBeFocused();
  await expect(page.getByRole('button', { name: '다시 도전' })).toBeVisible();
});

test('saved games remain after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  expect(page.viewportSize()).toMatchObject({ width: 360 });
  await openApp(page);
  await generateAndSaveFiveGames(page);

  await page.reload();
  await expect(page.getByText(/제\d+회 기준/)).toBeVisible();
  await page.getByRole('tab', { name: '저장' }).click();
  await expect(page.getByRole('article', { name: /저장 기록/ }).getByRole('listitem')).toHaveCount(5);
});

test('invalid network data falls back to the last validated bundle', async ({ page }) => {
  await openApp(page);
  const currentDrawStatus = await page.locator('.data-status').innerText();
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });

  await page.route('**/data/analysis.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"schemaVersion":999}' });
  });
  await page.reload();

  await expect(page.getByText(/오프라인.*저장 데이터 사용 중/)).toBeVisible();
  await expect(page.getByText(currentDrawStatus, { exact: true })).toBeVisible();
});

test('controlled service worker reports offline provenance after serving its populated runtime data cache', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  expect(page.viewportSize()).toMatchObject({ width: 320 });
  await openApp(page);
  await expect.poll(() => page.evaluate(async () => (
    await navigator.serviceWorker.getRegistrations()
  ).length)).toBe(1);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByText(/제\d+회 기준/)).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (
    await (await caches.open('lotto-public-data-v1')).keys()
  ).filter((request) => /\/data\/.*\.json$/.test(new URL(request.url).pathname)).length)).toBe(3);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: '로또 밸런스' })).toBeVisible();
    await expect(page.getByText(/제\d+회 기준/)).toBeVisible();
    await expect(page.getByText(/오프라인.*저장 데이터 사용 중/)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
