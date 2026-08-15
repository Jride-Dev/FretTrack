import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('Pro owner can access the scheduled email controls and drop-off template', async ({ page }) => {
  await openSeededJob(page);
  await page.getByRole('tab', { name: 'Print' }).click();

  await expect(page.getByText('Schedule Email', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Delivery date and time')).toBeEnabled();
  await page.getByLabel('Template').selectOption('drop_off_scheduled');
  await expect(page.getByLabel('Editable Message Preview')).toContainText('Your appointment is scheduled for');
});

test('scheduled email controls stay contained on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSeededJob(page);
  await page.getByRole('tab', { name: 'Print' }).click();

  const scheduling = page.locator('.message-scheduling');
  await expect(scheduling).toBeVisible();
  expect(await scheduling.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Schedule Email', exact: true })).toBeVisible();
});
