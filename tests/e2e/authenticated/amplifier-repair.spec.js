import { expect, test } from '@playwright/test';

test('Pro owner creates an amplifier work order and persists bench details through reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Amplifier Repair' }).click();

  await expect(page.getByRole('heading', { name: 'Amplifier Repair' })).toBeVisible();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer / Make').fill('Fender');
  await page.getByLabel('Model', { exact: true }).fill('Princeton Reverb');
  await page.getByLabel('Reported Symptoms / Customer Request').fill('Intermittent crackle during warm-up.');
  await page.getByRole('button', { name: 'Create Amplifier Work Order' }).click();

  await expect(page.getByText('Amplifier work order', { exact: true })).toBeVisible();
  const diagnosis = `Playwright amplifier diagnosis ${Date.now()}`;
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Save Amplifier Job' }).click();
  await expect(page.getByText(/Saved amplifier job .*/)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Diagnosis')).toHaveValue(diagnosis);
});
