import { expect } from '@playwright/test';

export async function openSeededJob(page, customerNumber = 1) {
  const customerName = `FicticiousJoe Customer ${customerNumber}`;

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign Out' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
  const jobRow = page.getByRole('row', {
    name: new RegExp(`Open job .* for ${customerName}$`),
  });
  await expect(jobRow).toBeVisible({ timeout: 15_000 });
  const detailHeading = page.getByRole('heading', { name: customerName });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await jobRow.click();
    try {
      await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click({ timeout: 5_000 });
      await detailHeading.waitFor({ state: 'visible', timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }
}
