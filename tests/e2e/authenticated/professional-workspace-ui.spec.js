import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('professional workspace navigation and theme choice persist', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'FretTrack workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
  await expect(page.getByLabel('Current job summary')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Job', exact: true })).toHaveCount(2);

  await page.getByLabel('Interface theme').selectOption('shop-light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'shop-light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'shop-light');

  await page.reload();
  await expect(page.getByLabel('Interface theme')).toHaveValue('shop-light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'shop-light');
});

test('professional workspace remains contained on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Current jobs' })).toBeVisible();

  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth);

  const firstRow = page.getByRole('row', { name: /Open job/ }).first();
  await expect(firstRow.locator('[data-label="Instrument"]')).toBeVisible();
  await expect(firstRow.locator('[data-label="Assigned Technician"]')).toBeVisible();
});

test('new work order and shared job detail use the professional workspace hierarchy', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Job', exact: true }).first().click();

  const intake = page.getByLabel('New job sections');
  await expect(intake.getByRole('heading', { name: 'New Work Order' })).toBeVisible();
  for (const heading of ['Customer', 'Instrument', 'Shop workflow', 'Customer request']) {
    await expect(intake.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(intake.getByRole('button', { name: 'Save Job' })).toContainText('Create Work Order');

  await openSeededJob(page, 1);
  await expect(page.getByText(/work order ·/i).first()).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Job workspace tabs' });
  await expect(tabs).toBeVisible();
  await tabs.getByRole('tab', { name: 'Parts & Billing' }).click();
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Parts', exact: true })).toBeVisible();
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Totals', exact: true })).toBeVisible();
});
