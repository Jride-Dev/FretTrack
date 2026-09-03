import { expect, test } from '@playwright/test';

test('Shop owner can see the amplifier upgrade surface but cannot create amplifier work', async ({ page }) => {
  await page.goto('/');
  const upgradeMessage = page.getByText('Amplifier Repair is available on Pro. Existing amplifier work orders remain available to view.');
  await expect(async () => {
    await page.getByRole('button', { name: 'Amplifier Repair' }).click();
    await expect(upgradeMessage).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole('button', { name: 'Create Amplifier Work Order' })).toBeDisabled();

  await page.getByRole('button', { name: 'New Job' }).click();
  await expect(page.getByRole('group', { name: 'Instrument Type' }).getByRole('button', { name: 'Amplifier' })).toHaveCount(0);
  await expect(page.getByLabel('New work order').getByRole('button', { name: 'Save Job' })).toBeEnabled();
});
