import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('Pro owner creates a keyboard work order and persists bench details through reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();

  await expect(page.getByRole('heading', { name: 'Keyboard Repair' })).toBeVisible();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer').fill('Roland');
  await page.getByLabel('Model', { exact: true }).fill('JUNO');
  await page.getByLabel('Reported Symptoms / Customer Request').fill('C3 has intermittent velocity response.');
  await page.getByRole('button', { name: 'Create Keyboard Work Order' }).click();

  await expect(page.getByText('Keyboard work order', { exact: true })).toBeVisible();
  const diagnosis = `Playwright keyboard diagnosis ${Date.now()}`;
  await page.getByLabel('Affected Keys').fill('C3');
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('group', { name: 'Final function test' }).getByLabel('Velocity response').selectOption('Passed');
  await page.getByRole('button', { name: 'Save Keyboard Job' }).click();
  await expect(page.getByText(/Saved keyboard job .*/)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Affected Keys')).toHaveValue('C3');
  await expect(page.getByLabel('Diagnosis')).toHaveValue(diagnosis);
  await expect(page.getByRole('group', { name: 'Final function test' }).getByLabel('Velocity response')).toHaveValue('Passed');
});

test('rejects a stale keyboard save instead of erasing another technician session', async ({ context, page }) => {
  const uniqueModel = `Concurrent Keyboard ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer').fill('Roland');
  await page.getByLabel('Model', { exact: true }).fill(uniqueModel);
  await page.getByLabel('Reported Symptoms / Customer Request').fill('Concurrent keyboard edit regression fixture.');
  await page.getByRole('button', { name: 'Create Keyboard Work Order' }).click();
  await expect(page.getByText('Keyboard work order', { exact: true })).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await secondPage.getByRole('button', { name: 'Keyboard Repair' }).click();
  await secondPage.getByRole('button', { name: new RegExp(uniqueModel) }).click();
  await expect(secondPage.getByLabel('Diagnosis')).toBeVisible();

  const firstDiagnosis = `First keyboard technician diagnosis ${Date.now()}`;
  await page.getByLabel('Diagnosis').fill(firstDiagnosis);
  await page.getByRole('button', { name: 'Save Keyboard Job' }).click();
  await expect(page.getByText(/Saved keyboard job .*/)).toBeVisible();

  await secondPage.getByLabel('Final Test Notes').fill('Stale second-session result.');
  await secondPage.getByRole('button', { name: 'Save Keyboard Job' }).click();
  await expect(secondPage.getByText(/changed in another session/)).toBeVisible();

  await secondPage.reload();
  await expect(secondPage.getByLabel('Diagnosis')).toHaveValue(firstDiagnosis);
  await expect(secondPage.getByLabel('Final Test Notes')).toHaveValue('');
});

test('concurrent amplifier and keyboard intake keep separate server-numbered work orders', async ({ context, page }) => {
  const amplifierPage = page;
  const keyboardPage = await context.newPage();
  const suffix = Date.now();
  const amplifierModel = `Parallel Amp ${suffix}`;
  const keyboardModel = `Parallel Keyboard ${suffix}`;

  await Promise.all([amplifierPage.goto('/'), keyboardPage.goto('/')]);
  await Promise.all([
    amplifierPage.getByRole('button', { name: 'Amplifier Repair' }).click(),
    keyboardPage.getByRole('button', { name: 'Keyboard Repair' }).click()
  ]);

  await amplifierPage.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await amplifierPage.getByLabel('Manufacturer / Make').fill('Fender');
  await amplifierPage.getByLabel('Model', { exact: true }).fill(amplifierModel);
  await amplifierPage.getByLabel('Reported Symptoms / Customer Request').fill('Parallel amplifier intake fixture.');

  await keyboardPage.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await keyboardPage.getByLabel('Manufacturer').fill('Roland');
  await keyboardPage.getByLabel('Model', { exact: true }).fill(keyboardModel);
  await keyboardPage.getByLabel('Reported Symptoms / Customer Request').fill('Parallel keyboard intake fixture.');

  await Promise.all([
    amplifierPage.getByRole('button', { name: 'Create Amplifier Work Order' }).click(),
    keyboardPage.getByRole('button', { name: 'Create Keyboard Work Order' }).click()
  ]);

  await expect(amplifierPage.getByText('Amplifier work order', { exact: true })).toBeVisible();
  await expect(amplifierPage.getByRole('heading', { name: new RegExp(amplifierModel) })).toBeVisible();
  await expect(keyboardPage.getByText('Keyboard work order', { exact: true })).toBeVisible();
  await expect(keyboardPage.getByRole('heading', { name: new RegExp(keyboardModel) })).toBeVisible();

  const amplifierJobNumber = await amplifierPage.locator('.amplifier-detail-header h2').textContent();
  const keyboardJobNumber = await keyboardPage.locator('.keyboard-detail-header h2').textContent();
  expect(amplifierJobNumber?.split('·')[0].trim()).not.toBe(keyboardJobNumber?.split('·')[0].trim());
});
