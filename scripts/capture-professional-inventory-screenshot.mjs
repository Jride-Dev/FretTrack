import { chromium } from '@playwright/test';

const baseUrl = process.env.FRETTRACK_SCREENSHOT_URL || 'http://127.0.0.1:5173/';
const storageState = process.env.FRETTRACK_SCREENSHOT_STORAGE || 'playwright/.auth/test1-owner.json';
const outputPath = 'cloudflare/frettrack-coming-soon/public/landing/inventory-bench-dark.png';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

try {
  await page.goto(baseUrl);
  await ensureLocalOwnerSession(page);
  await page.getByLabel('Interface theme').selectOption('bench-dark');
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.locator('.inventory-page').getByRole('heading', { name: 'Inventory', exact: true }).waitFor();
  await sanitizeFixtureText(page);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log('Professional inventory screenshot captured with fictional fixture text.');
} finally {
  await browser.close();
}

async function ensureLocalOwnerSession(targetPage) {
  const signOut = targetPage.getByRole('button', { name: 'Sign Out' }).first();
  if (await signOut.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)) return;
  await targetPage.getByRole('textbox', { name: 'Email', exact: true }).fill(process.env.PLAYWRIGHT_OWNER_EMAIL || 'test1.owner@frettrack.local');
  await targetPage.getByLabel('Password', { exact: true }).fill(process.env.PLAYWRIGHT_OWNER_PASSWORD || 'FretTrackTest123!');
  await targetPage.getByRole('button', { name: 'Sign In' }).click();
  await signOut.waitFor();
}

async function sanitizeFixtureText(targetPage) {
  await targetPage.evaluate(() => {
    document.querySelectorAll('.system-announcements').forEach((element) => element.remove());
    const replacements = [
      [/test1 shop/gi, 'Northline Instrument Repair'],
      [/test1\.owner@frettrack\.local/gi, 'owner@northline.example'],
      [/test1-shop\.example\.test/gi, 'northline.example']
    ];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      let value = node.nodeValue || '';
      for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
      node.nodeValue = value;
      node = walker.nextNode();
    }
  });
}
