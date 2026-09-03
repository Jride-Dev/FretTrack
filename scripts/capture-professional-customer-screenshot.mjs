import { chromium } from '@playwright/test';

const baseUrl = process.env.FRETTRACK_SCREENSHOT_URL || 'http://127.0.0.1:5173/';
const storageState = process.env.FRETTRACK_SCREENSHOT_STORAGE || 'playwright/.auth/test1-owner.json';
const outputPath = 'cloudflare/frettrack-coming-soon/public/landing/customers-bench-dark.png';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState,
  viewport: { width: 1600, height: 1000 }
});
const page = await context.newPage();

try {
  await page.goto(baseUrl);
  await ensureLocalOwnerSession(page);
  await page.getByLabel('Interface theme').selectOption('bench-dark');
  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  await page.locator('.customer-module').getByRole('heading', { name: 'Customer directory', exact: true }).waitFor();
  await sanitizeFixtureText(page);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log('Professional customer screenshot captured with fictional fixture text.');
} finally {
  await browser.close();
}

async function ensureLocalOwnerSession(targetPage) {
  const signOut = targetPage.getByRole('button', { name: 'Sign Out' }).first();
  if (await signOut.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)) {
    return;
  }

  await targetPage.getByRole('textbox', { name: 'Email', exact: true }).fill(process.env.PLAYWRIGHT_OWNER_EMAIL || 'test1.owner@frettrack.local');
  await targetPage.getByLabel('Password', { exact: true }).fill(process.env.PLAYWRIGHT_OWNER_PASSWORD || 'FretTrackTest123!');
  await targetPage.getByRole('button', { name: 'Sign In' }).click();
  await signOut.waitFor();
}

async function sanitizeFixtureText(targetPage) {
  await targetPage.evaluate(() => {
    document.querySelectorAll('.system-announcements').forEach((element) => element.remove());
    const fictionalNames = ['Jordan Rivera', 'Avery Chen', 'Morgan Ellis', 'Riley Bennett', 'Casey Brooks'];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      let value = node.nodeValue || '';
      value = value.replace(/FicticiousJoe Customer (\d+)/gi, (_match, customerNumber) => {
        const index = Math.max(0, Number(customerNumber) - 1) % fictionalNames.length;
        return fictionalNames[index];
      });
      value = value.replace(/ficticiousjoe\.customer(\d+)/gi, 'customer$1');
      value = value.replace(/[a-z0-9._%+-]+@test1\.example\.test/gi, 'customer@northline.example');
      value = value.replace(/^FicticiousJoe$/i, 'Casey');
      value = value.replace(/^Customer 20$/i, 'Brooks');
      value = value.replace(/test1 shop/gi, 'Northline Instrument Repair');
      value = value.replace(/test1\.owner@frettrack\.local/gi, 'owner@northline.example');
      value = value.replace(/test1-shop\.example\.test/gi, 'northline.example');
      node.nodeValue = value;
      node = walker.nextNode();
    }
  });
}
