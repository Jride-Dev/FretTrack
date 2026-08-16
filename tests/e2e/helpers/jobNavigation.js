import { expect } from '@playwright/test';

export async function openSeededJob(page, customerNumber = 1) {
  const customerName = `FicticiousJoe Customer ${customerNumber}`;

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign Out' }).first()).toBeVisible();
  const sidebarJob = page.getByRole('button', {
    name: new RegExp(`^#.* ${customerName} \\|`),
  });
  await expect(sidebarJob).toBeVisible({ timeout: 15_000 });
  const detailHeading = page.getByRole('heading', { name: customerName });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await sidebarJob.click();
    try {
      await detailHeading.waitFor({ state: 'visible', timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }
}
