import { describe, expect, it } from 'vitest';
import config from './playwright.config';

describe('Playwright production preview', () => {
  it('fails visibly instead of reusing a stale local server', () => {
    expect(config.webServer).not.toBeInstanceOf(Array);
    expect(config.webServer).toMatchObject({ reuseExistingServer: false });
    expect(config.webServer).toMatchObject({
      command: expect.stringContaining('--strictPort'),
    });
  });
});
