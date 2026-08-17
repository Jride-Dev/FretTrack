import { expect, test } from '@playwright/test';

test('Shop owner can see the keyboard upgrade surface but cannot create keyboard work', async ({ page }) => {
  await page.goto('/');
  const upgradeMessage = page.getByText('Keyboard Repair is available on Pro. Existing keyboard work orders remain available to view.');
  await expect(async () => {
    await page.getByRole('button', { name: 'Keyboard Repair' }).click();
    await expect(upgradeMessage).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole('button', { name: 'Create Keyboard Work Order' })).toBeDisabled();

  await page.getByRole('button', { name: 'New Job' }).click();
  await expect(page.getByRole('group', { name: 'Instrument Type' }).getByRole('button', { name: 'Keyboard / Synthesizer' })).toHaveCount(0);
});
