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

  await page.getByRole('button', { name: 'Guitar Bench' }).click();
  await expect(page.getByText('Guitar work order', { exact: true })).toBeVisible();
});
