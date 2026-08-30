import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('rejects a stale work-order save before it can overwrite linked customer details', async ({ context, page }) => {
  await openSeededJob(page, 18);
  await page.getByRole('tab', { name: 'Intake' }).click();

  const secondPage = await context.newPage();
  await openSeededJob(secondPage, 18);
  await secondPage.getByRole('tab', { name: 'Intake' }).click();

  const firstEditorName = `Concurrency${Date.now()}`;
  const staleEditorLastName = `Stale${Date.now()}`;
  const firstEditorJobInfo = page.getByRole('heading', { name: 'Job Info' }).locator('..');
  const staleEditorJobInfo = secondPage.getByRole('heading', { name: 'Job Info' }).locator('..');
  await firstEditorJobInfo.getByLabel('First Name').fill(firstEditorName);
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText(/Saved job .* successfully\./)).toBeVisible();

  await staleEditorJobInfo.getByLabel('Last Name').fill(staleEditorLastName);
  await secondPage.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(secondPage.getByText(/changed in another session/)).toBeVisible();
  await expect(secondPage.getByText(/Saved job .* successfully\./)).toHaveCount(0);

  await secondPage.reload();
  await expect(secondPage.getByRole('heading', { name: new RegExp(firstEditorName) })).toBeVisible();
  await secondPage.getByRole('tab', { name: 'Intake' }).click();
  const reloadedJobInfo = secondPage.getByRole('heading', { name: 'Job Info' }).locator('..');
  await expect(reloadedJobInfo.getByLabel('First Name')).toHaveValue(firstEditorName);
  await expect(reloadedJobInfo.getByLabel('Last Name')).not.toHaveValue(staleEditorLastName);
});
