import { expect, test } from '@playwright/test';

test('opens the seeded owner workspace with only its assigned shop', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('test1 shop', { exact: true })).toBeVisible();
  await expect(page.getByText('test2 shop', { exact: true })).toHaveCount(0);
  await expect(async () => {
    await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Current jobs' })).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole('heading', { name: 'Current Jobs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Job' })).toBeEnabled();
});
