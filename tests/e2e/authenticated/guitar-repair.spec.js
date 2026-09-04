import { expect, test } from '@playwright/test';

test('opens guitar jobs in the focused bench and retains the complete work-order bridge', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
  await page.getByRole('row', { name: /Open job .* for FicticiousJoe Customer 1$/ }).click();

  await expect(page.getByText('Guitar work order', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guitar Bench' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Work Order' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guitar Identity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tech Details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Damage Map' })).toBeVisible();
  await expect(page.getByText('Amplifier work order', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Keyboard work order', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();
  await expect(page.getByRole('tab', { name: 'Parts & Billing' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Work Order, Parts & Payments' })).toHaveAttribute('aria-pressed', 'true');
  const serviceQuantity = page.getByRole('heading', { name: 'Services' }).locator('..').getByPlaceholder('Qty');
  await expect(serviceQuantity).toHaveAttribute('step', '1');
  await serviceQuantity.fill('2.5');
  await expect(serviceQuantity).toHaveValue('2');

  await page.getByRole('button', { name: 'Guitar Bench' }).click();
  await expect(page.getByText('Guitar work order', { exact: true })).toBeVisible();
});

test('opens the dedicated estimates queue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Estimates', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estimates' })).toBeVisible();
  await expect(page.getByLabel('Estimate status filter')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estimate queue' })).toBeVisible();
});

test('creates an editable estimate document', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
  await page.getByRole('row', { name: /Open job .* for FicticiousJoe Customer 2$/ }).click();
  await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();
  await expect(page.getByRole('tab', { name: 'Parts & Billing' })).toHaveAttribute('aria-selected', 'true');

  const documentType = page.getByLabel('Document Type');
  await documentType.selectOption('estimate');
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(documentType).toHaveValue('estimate');
  await expect(page.getByRole('button', { name: 'Email Estimate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record Approval' })).toHaveCount(0);
  await expect(page.getByLabel('Estimate audit note')).toHaveCount(0);
  await expect(page.getByText('Total Due')).toBeVisible();
  await expect(page.getByPlaceholder('Part name or description')).toBeEnabled();
});
