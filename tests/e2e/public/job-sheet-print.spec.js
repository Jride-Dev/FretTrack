import { expect, test } from '@playwright/test';

test('isolated amplifier Job Sheet retains billing and specialist terminology', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await page.goto('/tests/fixtures/job-sheet-print.html');

  const sheet = page.locator('.print-job-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Job Sheet' })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Invoice summary' })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Amplifier service summary' })).toBeVisible();
  await expect(sheet.getByText('Matched 6V6 power-tube pair')).toBeVisible();
  await expect(sheet.getByText('$260.63')).toBeVisible();
  await expect(sheet.getByText('$160.63')).toBeVisible();
  await expect(sheet.getByText('Final guitar inspection')).toHaveCount(0);
  await expect(sheet.getByText('New string gauge')).toHaveCount(0);

  const overflow = await sheet.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
