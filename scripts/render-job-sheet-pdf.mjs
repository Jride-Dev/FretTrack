import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = String(process.env.FRETTRACK_PRINT_FIXTURE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const outputPath = resolve('output/pdf/frettrack-job-sheet-qa.pdf');

await mkdir(resolve('output/pdf'), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.goto(`${baseUrl}/tests/fixtures/job-sheet-print.html`, { waitUntil: 'networkidle' });
  const sheet = page.locator('.print-job-sheet');
  await sheet.waitFor({ state: 'visible' });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.print-job-sheet img')).every((image) => image.complete));

  const content = await sheet.innerText();
  for (const requiredText of ['Invoice summary', 'Amplifier service summary', '$260.63', '$160.63']) {
    if (!content.includes(requiredText)) throw new Error(`Job Sheet is missing required text: ${requiredText}`);
  }
  if (content.includes('Final guitar inspection') || content.includes('New string gauge')) {
    throw new Error('Amplifier Job Sheet leaked guitar-specific inspection fields.');
  }

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
