import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const offset = (y * size + x) * 4;
  pixels.set(color, offset);
}

function fillRect(pixels, size, left, top, right, bottom, color) {
  for (let y = Math.floor(top * size); y < Math.ceil(bottom * size); y += 1) {
    for (let x = Math.floor(left * size); x < Math.ceil(right * size); x += 1) {
      setPixel(pixels, size, x, y, color);
    }
  }
}

function makeIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const background = [38, 92, 229, 255];
  const outline = [255, 255, 255, 255];
  const ball = [244, 202, 50, 255];
  const ink = [23, 32, 51, 255];
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center) / size;
      const color = distance <= 0.38 ? outline : background;
      setPixel(pixels, size, x, y, color);
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (Math.hypot(x - center, y - center) / size <= 0.34) {
        setPixel(pixels, size, x, y, ball);
      }
    }
  }

  // Seven-segment numeral 6: a, f, g, e, d, c.
  fillRect(pixels, size, 0.43, 0.31, 0.57, 0.35, ink);
  fillRect(pixels, size, 0.39, 0.35, 0.43, 0.49, ink);
  fillRect(pixels, size, 0.43, 0.48, 0.57, 0.52, ink);
  fillRect(pixels, size, 0.39, 0.51, 0.43, 0.65, ink);
  fillRect(pixels, size, 0.43, 0.65, 0.57, 0.69, ink);
  fillRect(pixels, size, 0.57, 0.51, 0.61, 0.65, ink);

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const path = resolve(`public/icons/icon-${size}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, makeIcon(size));
}
