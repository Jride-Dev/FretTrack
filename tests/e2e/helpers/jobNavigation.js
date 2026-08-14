import { expect } from '@playwright/test';

export async function openSeededJob(page, customerNumber = 1) {
  const customerName = `FicticiousJoe Customer ${customerNumber}`;

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign Out' }).first()).toBeVisible();
  const sidebarJob = page.getByRole('button', {
    name: new RegExp(`^#.* ${customerName} \\|`),
  });
  await expect(sidebarJob).toBeVisible({ timeout: 15_000 });
  await sidebarJob.click();
  await expect(page.getByRole('heading', { name: customerName })).toBeVisible();
}
