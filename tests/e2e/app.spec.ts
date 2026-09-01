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

test('all main screens fit without horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openApp(page);

  for (const tab of ['추천', '분석', '검증', '저장']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
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

test('user can read the verification conclusion', async ({ page }) => {
  await openApp(page);
  await page.getByRole('tab', { name: '검증' }).click();

  await expect(page.getByText('무작위 대비 우위 확인 안 됨', { exact: true })).toBeVisible();
  await expect(page.getByLabel('평균 일치 수 차이 불확실성')).toContainText('95% 구간');
});

test('saved games remain after a reload', async ({ page }) => {
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

  await expect(page.getByText('오프라인 저장 데이터로 표시 중입니다.')).toBeVisible();
  await expect(page.getByText(currentDrawStatus, { exact: true })).toBeVisible();
});

test('service worker reloads the app offline after one online visit', async ({ page, context }) => {
  await openApp(page);
  await expect.poll(() => page.evaluate(async () => (
    await navigator.serviceWorker.getRegistrations()
  ).length)).toBe(1);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: '로또 밸런스' })).toBeVisible();
    await expect(page.getByText(/제\d+회 기준/)).toBeVisible();
    await expect(page.getByText('오프라인 저장 데이터로 표시 중입니다.')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
