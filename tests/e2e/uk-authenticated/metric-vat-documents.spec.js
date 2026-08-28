import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('uses UK metric and VAT settings in job detail and printable documents', async ({ page }) => {
  await openSeededJob(page, 1);

  await page.getByRole('tab', { name: 'Inspection' }).click();
  await expect(page.locator('.neck-inspection-grid').getByText('Relief (mm)', { exact: true })).toHaveCount(2);
  await expect(page.getByLabel('Initial Neck Inspection measurement unit from Shop Settings')).toHaveValue('mm');
  await expect(page.getByLabel('Final Neck Inspection measurement unit from Shop Settings')).toHaveValue('mm');

  await page.getByRole('tab', { name: 'Parts & Billing' }).click();
  await expect(page.getByLabel('VAT %')).toHaveValue('20');
  const billingTotals = page.getByRole('heading', { name: 'Totals', exact: true }).locator('..').locator('.totals');
  await expect(billingTotals).toContainText('VAT');
  await expect(billingTotals).toContainText('£');

  const jobSheet = page.locator('.print-job-sheet');
  await expect(jobSheet).toContainText('VAT');
  await expect(jobSheet).toContainText('Relief (mm)');
  await expect(jobSheet).toContainText('0.15 mm');
  await expect(jobSheet).toContainText('£');
});
