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

  const longValue = 'Alexandria Montgomery-Worthington Custom Extended Workshop Assignment';
  for (const label of ['Customer', 'Instrument', 'Assigned Technician']) {
    await firstRow.locator(`[data-label="${label}"]`).evaluate((element, value) => {
      element.textContent = value;
    }, longValue);
  }

  const wrapping = await firstRow.evaluate((row) => ({
    rowWhiteSpace: window.getComputedStyle(row).whiteSpace,
    values: [...row.querySelectorAll('[data-label="Customer"], [data-label="Instrument"], [data-label="Assigned Technician"]')]
      .map((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: window.getComputedStyle(element).whiteSpace
      }))
  }));
  expect(wrapping.rowWhiteSpace).toBe('normal');
  for (const value of wrapping.values) {
    expect(value.whiteSpace).toBe('normal');
    expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
  }
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

test('customers use the professional directory and profile hierarchy', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Customers', exact: true }).click();

  const customers = page.locator('.customer-module');
  await expect(customers.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect(customers.getByRole('heading', { name: 'Find a customer', exact: true })).toBeVisible();
  await expect(customers.getByRole('heading', { name: 'Customer directory', exact: true })).toBeVisible();
  await expect(customers.getByPlaceholder('Name, company, phone, email, tax ID, or notes')).toBeVisible();

  for (const heading of ['Account overview', 'Contact & account', 'Job history', 'Payments', 'Notes']) {
    await expect(customers.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(customers.getByRole('button', { name: 'Edit Profile', exact: true })).toBeVisible();
  await expect(customers.getByRole('button', { name: 'Create Job', exact: true })).toBeVisible();
});

test('customer directory remains contained on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  const customers = page.locator('.customer-module');
  await expect(customers.getByRole('heading', { name: 'Customer directory', exact: true })).toBeVisible();

  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth);

  const firstCustomer = customers.locator('.customer-list-panel .customer-card').first();
  const customerCard = await firstCustomer.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    columns: window.getComputedStyle(element).gridTemplateColumns
  }));
  expect(customerCard.scrollWidth).toBeLessThanOrEqual(customerCard.clientWidth);
  expect(customerCard.columns.trim().split(/\s+/)).toHaveLength(1);
});
