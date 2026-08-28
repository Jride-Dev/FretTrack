import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = String(process.env.FRETTRACK_PRINT_FIXTURE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const outputPath = resolve('output/pdf/frettrack-customer-report-qa.pdf');

await mkdir(resolve('output/pdf'), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.goto(`${baseUrl}/tests/fixtures/customer-report-print.html`, { waitUntil: 'networkidle' });
  await page.locator('.print-damage-report').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.print-damage-report img')).every((image) => image.complete));

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('.print-damage-map-stage');
    const stageRect = stage.getBoundingClientRect();
    return Array.from(stage.querySelectorAll('.print-damage-marker')).map((marker) => {
      const markerRect = marker.getBoundingClientRect();
      return {
        x: ((markerRect.left + markerRect.width / 2 - stageRect.left) / stageRect.width) * 100,
        y: ((markerRect.top + markerRect.height / 2 - stageRect.top) / stageRect.height) * 100
      };
    });
  });

  const expected = [{ x: 25, y: 36 }, { x: 52, y: 57 }, { x: 78, y: 24 }];
  geometry.forEach((actual, index) => {
    if (Math.abs(actual.x - expected[index].x) > 0.2 || Math.abs(actual.y - expected[index].y) > 0.2) {
      throw new Error(`Printed marker ${index + 1} drifted to ${actual.x.toFixed(2)}%, ${actual.y.toFixed(2)}%.`);
    }
  });

  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
  });

  console.log(`Rendered ${outputPath}`);
} finally {
  await browser.close();
}
