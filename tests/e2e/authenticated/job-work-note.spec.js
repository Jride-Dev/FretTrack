import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test.describe.configure({ mode: 'serial' });

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

test('keeps an in-flight work note scoped to its original job', async ({ page }) => {
  let releaseSave;
  let markSaveStarted;
  let markHeldRequestFinished;
  const saveStarted = new Promise((resolve) => {
    markSaveStarted = resolve;
  });
  const saveRelease = new Promise((resolve) => {
    releaseSave = resolve;
  });
  const heldRequestFinished = new Promise((resolve) => {
    markHeldRequestFinished = resolve;
  });

  await page.route('**/rest/v1/jobs*', async (route) => {
    if (route.request().method() === 'PATCH') {
      markSaveStarted();
      await saveRelease;
      await route.continue();
      markHeldRequestFinished();
      return;
    }
    await route.continue();
  });

  try {
    await openSeededJob(page, 1);
    await page.getByRole('tab', { name: 'Work' }).click();
    await page.getByLabel('New Work Note').fill(`Held Work Note ${Date.now()}`);
    await page.getByRole('button', { name: 'Save Work Note' }).click();
    await saveStarted;

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
    await page.getByRole('row', { name: /Open job .* FicticiousJoe Customer 2$/ }).click();
    await expect(page.getByText('Guitar work order', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();
    await expect(page.getByRole('heading', { name: 'FicticiousJoe Customer 2' })).toBeVisible();
    await page.getByRole('tab', { name: 'Work' }).click();
    await expect(page.getByLabel('New Work Note')).toHaveValue('');
    await expect(page.getByText('Saving Work Note…')).toHaveCount(0);
    await expect(page.getByText(/Unsaved Work Note/)).toHaveCount(0);
    const secondJobNote = `Independent Job B note ${Date.now()}`;
    await page.getByLabel('New Work Note').fill(secondJobNote);

    releaseSave();
    await heldRequestFinished;
    await page.waitForTimeout(250);
    await expect(page.getByRole('heading', { name: 'FicticiousJoe Customer 2' })).toBeVisible();
    await expect(page.getByLabel('New Work Note')).toHaveValue(secondJobNote);
    await expect(page.getByText('Saving Work Note…')).toHaveCount(0);
    await expect(page.getByText(/Unsaved Work Note/)).toBeVisible();
  } finally {
    releaseSave?.();
  }
});
