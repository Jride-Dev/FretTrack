import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('coalesces rapid work note saves and persists exactly one entry', async ({ page }) => {
  await openSeededJob(page, 1);
  await page.getByRole('tab', { name: 'Work' }).click();

  const note = `Playwright saved work note ${Date.now()}`;
  const draftStatus = page.locator('.work-log-draft-status');
  await page.getByLabel('New Work Note').fill(note);
  await expect(draftStatus).toContainText('Unsaved Work Note');
  await page.getByLabel('New Work Note').evaluate((textarea) => {
    const form = textarea.closest('form');
    form.requestSubmit();
    form.requestSubmit();
  });

  await expect(draftStatus).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save Work Note' })).toBeDisabled();
  await expect(page.locator('.entries textarea').last()).toHaveValue(note);

  await page.reload();
  await openSeededJob(page, 1);
  await page.getByRole('tab', { name: 'Work' }).click();
  await expect.poll(() => page.locator('.entries textarea').evaluateAll(
    (entries, expectedNote) => entries.filter((entry) => entry.value === expectedNote).length,
    note
  )).toBe(1);
});
