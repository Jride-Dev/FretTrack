import { expect, test } from '@playwright/test';

test('Shop owner can see the amplifier upgrade surface but cannot create amplifier work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Amplifier Repair' }).click();

  await expect(page.getByText('Amplifier Repair is available on Pro. Existing amplifier work orders remain available to view.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Amplifier Work Order' })).toBeDisabled();

  await page.getByRole('button', { name: 'New Job' }).click();
  await expect(page.getByRole('group', { name: 'Instrument Type' }).getByRole('button', { name: 'Amplifier' })).toHaveCount(0);
  await expect(page.getByLabel('New job sections').getByRole('button', { name: 'Save Job' })).toBeEnabled();
});
