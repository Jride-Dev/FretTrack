import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('saves a work note before it can disappear from the job', async ({ page }) => {
  await openSeededJob(page, 1);
  await page.getByRole('tab', { name: 'Work' }).click();

  const note = `Playwright saved work note ${Date.now()}`;
  const draftStatus = page.locator('.work-log-draft-status');
  await page.getByLabel('New Work Note').fill(note);
  await expect(draftStatus).toContainText('Unsaved Work Note');
  await page.getByRole('button', { name: 'Save Work Note' }).click();

  await expect(draftStatus).toHaveCount(0);
  await expect(page.locator('.entries textarea').last()).toHaveValue(note);
});
