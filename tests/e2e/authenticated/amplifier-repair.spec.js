import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

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

  const partName = `Amplifier bench resistor ${Date.now()}`;
  const paymentNote = `Amplifier deposit ${Date.now()}`;
  const inspectionNote = `Amplifier safety inspection ${Date.now()}`;
  await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();
  await expect(page.getByRole('tab', { name: 'Parts & Billing' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Amplifier Inspection' }).click();
  await expect(page.getByRole('heading', { name: 'Amplifier Inspection' })).toBeVisible();
  await expect(page.getByText('Neck Inspection', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Damage Map', { exact: true })).toHaveCount(0);
  await page.getByLabel('Safety / Visual Condition').fill(inspectionNote);
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText(/Saved job .* successfully\./)).toBeVisible();
  await page.getByRole('tab', { name: 'Parts & Billing' }).click();
  const partForm = page.getByPlaceholder('Part name or description').locator('..');
  await partForm.getByPlaceholder('Part name or description').fill(partName);
  await partForm.getByPlaceholder('Qty', { exact: true }).fill('2');
  await partForm.getByPlaceholder('Unit cost').fill('3.50');
  await partForm.getByPlaceholder('Unit price').fill('8.00');
  await partForm.getByRole('button', { name: 'Add Part' }).click();
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText(/Saved job .* successfully\./)).toBeVisible();

  await page.getByPlaceholder('Payment amount').fill('10.00');
  await page.getByLabel('Payment method').selectOption('Card');
  await page.getByPlaceholder('Payment note').fill(paymentNote);
  const paymentSaved = page.waitForResponse((response) => (
    response.url().includes('/rest/v1/work_logs')
    && response.request().method() === 'DELETE'
    && response.ok()
  ));
  await page.getByRole('button', { name: 'Add Payment' }).click();
  await paymentSaved;
  await expect.poll(() => page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value))).toContain(paymentNote);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Parts & Billing' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value))).toContain(partName);
  await expect.poll(() => page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value))).toContain(paymentNote);
  await page.getByRole('tab', { name: 'Amplifier Inspection' }).click();
  await expect(page.getByLabel('Safety / Visual Condition')).toHaveValue(inspectionNote);
  await page.getByRole('button', { name: 'Amplifier Bench' }).click();
  await expect(page.getByLabel('Diagnosis')).toHaveValue(diagnosis);
});

test('billing save reports failure and preserves saved parts when part persistence fails', async ({ page }) => {
  const suffix = Date.now();
  const savedPart = `Saved amplifier capacitor ${suffix}`;
  const failedPart = `Interrupted amplifier resistor ${suffix}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Amplifier Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer / Make').fill('Fender');
  await page.getByLabel('Model', { exact: true }).fill(`Billing Failure Amp ${suffix}`);
  await page.getByLabel('Reported Symptoms / Customer Request').fill('Billing child persistence regression fixture.');
  await page.getByRole('button', { name: 'Create Amplifier Work Order' }).click();
  await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();

  const addManualPart = async (name) => {
    const partForm = page.getByPlaceholder('Part name or description').locator('..');
    await partForm.getByPlaceholder('Part name or description').fill(name);
    await partForm.getByPlaceholder('Unit price').fill('12.00');
    await partForm.getByRole('button', { name: 'Add Part' }).click();
  };

  await addManualPart(savedPart);
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText(/Saved job .* successfully\./)).toBeVisible();

  await addManualPart(failedPart);
  await page.route('**/rest/v1/job_parts*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'ITO_PART_FAILURE', message: 'forced part persistence failure' })
      });
      return;
    }
    await route.continue();
  });

  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText('Billing parts save failed: forced part persistence failure')).toBeVisible();
  await expect(page.getByText(/Saved job .* successfully\./)).toHaveCount(0);
  await page.unroute('**/rest/v1/job_parts*');

  await page.reload();
  await expect.poll(() => page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value))).toContain(savedPart);
  await expect.poll(() => page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value))).not.toContain(failedPart);

  await addManualPart(failedPart);
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText(/Saved job .* successfully\./)).toBeVisible();
  await page.reload();
  await expect.poll(() => page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value))).toContain(failedPart);
});

test('rejects a stale amplifier save instead of erasing another session', async ({ context, page }) => {
  const uniqueModel = `Concurrent Amp ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Amplifier Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer / Make').fill('Fender');
  await page.getByLabel('Model', { exact: true }).fill(uniqueModel);
  await page.getByLabel('Reported Symptoms / Customer Request').fill('Concurrent edit regression fixture.');
  await page.getByRole('button', { name: 'Create Amplifier Work Order' }).click();
  await expect(page.getByText('Amplifier work order', { exact: true })).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await secondPage.getByRole('button', { name: 'Amplifier Repair' }).click();
  await secondPage.getByRole('button', { name: new RegExp(uniqueModel) }).click();
  await expect(secondPage.getByLabel('Diagnosis')).toBeVisible();

  const firstDiagnosis = `First technician diagnosis ${Date.now()}`;
  await page.getByLabel('Diagnosis').fill(firstDiagnosis);
  await page.getByRole('button', { name: 'Save Amplifier Job' }).click();
  await expect(page.getByText(/Saved amplifier job .*/)).toBeVisible();

  await secondPage.getByLabel('Bench Test Notes').fill('Second technician stale-session measurement.');
  await secondPage.getByRole('button', { name: 'Save Amplifier Job' }).click();
  await expect(secondPage.getByText(/changed in another session/)).toBeVisible();

  await secondPage.reload();
  await expect(secondPage.getByLabel('Diagnosis')).toHaveValue(firstDiagnosis);
  await expect(secondPage.getByLabel('Bench Test Notes')).toHaveValue('');
});
