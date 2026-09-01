import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

async function readWorkflow(name: string): Promise<string> {
  try {
    return await readFile(resolve(process.cwd(), '.github', 'workflows', name), 'utf8');
  } catch {
    return '';
  }
}

function actionUses(workflow: string): string[] {
  return [...workflow.matchAll(/^\s*-?\s*uses:\s*(\S+)\s*$/gm)].map((match) => match[1]);
}

function singleLineRuns(workflow: string): string[] {
  return [...workflow.matchAll(/^\s*-?\s*run:\s*([^|>].*?)\s*$/gm)].map((match) => match[1]);
}

function cronSchedules(workflow: string): string[] {
  return [...workflow.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function expectInOrder(workflow: string, markers: readonly string[]): void {
  let previous = -1;
  for (const marker of markers) {
    const current = workflow.indexOf(marker, previous + 1);
    expect(current, `missing or out-of-order workflow marker: ${marker}`).toBeGreaterThan(previous);
    previous = current;
  }
}

describe('GitHub Actions workflows', () => {
  it('runs the complete CI verification sequence on Node 24 and Chromium', async () => {
    const workflow = await readWorkflow('ci.yml');

    expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(actionUses(workflow)).toEqual([
      'actions/checkout@v6',
      'actions/setup-node@v6',
    ]);
    expect(workflow).toMatch(/node-version:\s*24/);
    expect(singleLineRuns(workflow)).toEqual([
      'npm ci',
      'npx playwright install --with-deps chromium',
      'npm test',
      'npm run reports:build',
      'npm run build',
      'npm run e2e',
    ]);
  });

  it('uses the two approved UTC schedules and pinned Pages actions', async () => {
    const workflow = await readWorkflow('pages.yml');

    expect(cronSchedules(workflow)).toEqual(['17 13 * * 6', '17 22 * * 6']);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
    expect(workflow).toMatch(/contents:\s*write/);
    expect(workflow).toMatch(/pages:\s*write/);
    expect(workflow).toMatch(/id-token:\s*write/);
    expect(workflow).toMatch(/group:\s*pages/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
    expect(actionUses(workflow)).toEqual([
      'actions/checkout@v6',
      'actions/setup-node@v6',
      'actions/configure-pages@v6',
      'actions/upload-pages-artifact@v5',
      'actions/deploy-pages@v5',
    ]);
  });

  it('validates updated data before committing and deploying the same build', async () => {
    const workflow = await readWorkflow('pages.yml');

    expectInOrder(workflow, [
      'npm run data:update',
      'npm test',
      'npm run reports:build',
      'npm run build',
      'Commit validated draw data',
      'actions/configure-pages@v6',
      'actions/upload-pages-artifact@v5',
      'needs: build',
      'actions/deploy-pages@v5',
    ]);
    expect(workflow).toContain("if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('git diff --quiet -- public/data/draws.json');
    expect(workflow).toContain('git add public/data/draws.json');
    expect(workflow).toContain('git push');
    expect(workflow).toMatch(/path:\s*dist/);
  });
});
