import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (path: string) => resolve(process.cwd(), path);

describe('PWA install assets', () => {
  it('provides the exact install manifest and icon declarations', async () => {
    const manifest = JSON.parse(await readFile(projectFile('public/manifest.webmanifest'), 'utf8')) as Record<string, unknown>;

    expect(manifest).toMatchObject({
      name: '로또 밸런스',
      short_name: '로또',
      display: 'standalone',
      start_url: './',
      scope: './',
      theme_color: '#265ce5',
      background_color: '#f5f7fb',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  });

  it.each([192, 512])('ships a real %ipx PNG icon with exact dimensions', async (size) => {
    const icon = await readFile(projectFile(`public/icons/icon-${size}.png`));

    expect([...icon.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(icon.toString('ascii', 12, 16)).toBe('IHDR');
    expect(icon.readUInt32BE(16)).toBe(size);
    expect(icon.readUInt32BE(20)).toBe(size);
  });

  it('links the manifest and Apple install icon from the HTML shell', async () => {
    const html = await readFile(projectFile('index.html'), 'utf8');

    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="./icons/icon-192.png" />');
    expect(html).toContain('<meta name="theme-color" content="#265ce5" />');
  });
});
