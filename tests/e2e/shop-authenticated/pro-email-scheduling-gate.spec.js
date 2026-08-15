import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('Shop owner sees the Pro scheduled email gate without losing immediate email', async ({ page }) => {
  await openSeededJob(page);
  await page.getByRole('tab', { name: 'Print' }).click();

  await expect(page.getByText('Upgrade to Pro to schedule customer email.')).toBeVisible();
  await expect(page.getByLabel('Delivery date and time')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Schedule Email', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send Email', exact: true })).toBeVisible();
});
