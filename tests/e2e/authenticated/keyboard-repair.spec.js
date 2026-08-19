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

  const partName = `Keyboard contact strip ${Date.now()}`;
  const paymentNote = `Keyboard deposit ${Date.now()}`;
  const inspectionNote = `Keyboard contact inspection ${Date.now()}`;
  await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();
  await expect(page.getByRole('tab', { name: 'Parts & Billing' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Keyboard Inspection' }).click();
  await expect(page.getByRole('heading', { name: 'Keyboard Inspection' })).toBeVisible();
  await expect(page.getByText('Neck Inspection', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Damage Map', { exact: true })).toHaveCount(0);
  await page.getByLabel('Keybed / Contact Inspection').fill(inspectionNote);
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText(/Saved job .* successfully\./)).toBeVisible();
  await page.getByRole('tab', { name: 'Parts & Billing' }).click();
  const partForm = page.getByPlaceholder('Part name or description').locator('..');
  await partForm.getByPlaceholder('Part name or description').fill(partName);
  await partForm.getByPlaceholder('Qty', { exact: true }).fill('1');
  await partForm.getByPlaceholder('Unit cost').fill('12.00');
  await partForm.getByPlaceholder('Unit price').fill('28.00');
  await partForm.getByRole('button', { name: 'Add Part' }).click();
  await page.locator('header').getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByText(/Saved job .* successfully\./)).toBeVisible();

  await page.getByPlaceholder('Payment amount').fill('15.00');
  await page.locator('.payment-form select').selectOption('Cash');
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
  await page.getByRole('tab', { name: 'Keyboard Inspection' }).click();
  await expect(page.getByLabel('Keybed / Contact Inspection')).toHaveValue(inspectionNote);
  await page.getByRole('button', { name: 'Keyboard Bench' }).click();
  await expect(page.getByLabel('Diagnosis')).toHaveValue(diagnosis);
});

test('rapid duplicate activation creates exactly one keyboard work order', async ({ page }) => {
  const uniqueModel = `Double Submit Keyboard ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer').fill('Roland');
  await page.getByLabel('Model', { exact: true }).fill(uniqueModel);
  await page.getByLabel('Reported Symptoms / Customer Request').fill('Rapid duplicate intake regression fixture.');

  const createButton = page.getByRole('button', { name: 'Create Keyboard Work Order' });
  await createButton.evaluate((button) => {
    const form = button.closest('form');
    form.requestSubmit(button);
    form.requestSubmit(button);
  });

  await expect(page.getByText('Keyboard work order', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();
  await page.getByLabel('Search').fill(uniqueModel);
  await expect(page.getByRole('button', { name: new RegExp(uniqueModel) })).toHaveCount(1);
});

test('restores an open keyboard work order after a delayed reload', async ({ page }) => {
  const uniqueModel = `Reload Keyboard ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer').fill('Korg');
  await page.getByLabel('Model', { exact: true }).fill(uniqueModel);
  await page.getByLabel('Reported Symptoms / Customer Request').fill('Immediate detail reload regression fixture.');
  await page.getByRole('button', { name: 'Create Keyboard Work Order' }).click();
  await expect(page.getByText('Keyboard work order', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const stateKey = Object.keys(localStorage).find((key) => key.startsWith('frettrack_workspace_state:'));
    return stateKey ? JSON.parse(localStorage.getItem(stateKey) || '{}').mode : '';
  })).toBe('keyboard-detail');

  let markJobsLoadStarted;
  let releaseJobsLoad;
  const jobsLoadStarted = new Promise((resolve) => { markJobsLoadStarted = resolve; });
  const jobsLoadRelease = new Promise((resolve) => { releaseJobsLoad = resolve; });
  await page.route('**/rest/v1/jobs*', async (route) => {
    if (route.request().method() === 'GET') {
      markJobsLoadStarted();
      await jobsLoadRelease;
    }
    await route.continue();
  });

  try {
    const reload = page.reload();
    await jobsLoadStarted;
    await expect(page.getByText('Loading shop workspace...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Job' })).toHaveCount(0);
    releaseJobsLoad();
    await reload;

    await expect(page.getByText('Keyboard work order', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(uniqueModel) })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keyboard Identity' })).toBeVisible();
  } finally {
    releaseJobsLoad?.();
    await page.unroute('**/rest/v1/jobs*');
  }
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

test('persists per-key faults, MIDI evidence, checklist progress, and parts requests', async ({ page }) => {
  const suffix = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer').fill('Yamaha');
  await page.getByLabel('Model', { exact: true }).fill(`Workflow Piano ${suffix}`);
  await page.getByLabel('Keyboard Type').selectOption('Digital Piano');
  await page.getByLabel('Key Count').selectOption('88');
  await page.getByLabel('Sensor Technology').selectOption('Triple sensor');
  await page.getByLabel('Reported Symptoms / Customer Request').fill('C4 drops notes at low velocity.');
  await page.getByRole('button', { name: 'Create Keyboard Work Order' }).click();

  await page.getByRole('button', { name: 'C4, no finding' }).click();
  await page.locator('select[name="faultCode"]').selectOption('dead_rubber_contact');
  await page.getByLabel('Finding Notes').fill('Middle contact pair does not close consistently.');
  await page.getByRole('button', { name: 'Save Key Finding' }).click();
  await expect(page.getByText('Saved C4 diagnostic finding.')).toBeVisible();

  await page.getByLabel('Raw MIDI Diagnostic Log').fill('NOTE_ON ch=1 note=60 velocity=0\nNOTE_ON ch=1 note=62 velocity=118');
  await expect(page.getByText('D4: Missing Note Off')).toBeVisible();
  await page.getByRole('button', { name: 'Apply MIDI Findings' }).click();
  await expect(page.getByText('Applied 1 MIDI finding to the keybed.')).toBeVisible();
  await page.getByLabel('MIDI Diagnostic Summary').fill('C4 misses low-velocity strikes.');
  await page.getByLabel('Diagnostic Path').selectOption('piano');
  await page.getByLabel('Run a slow and fast full-key sweep for trigger and velocity consistency status').selectOption('Attention');
  await page.getByLabel('Requested Part').fill('C4 rubber contact strip');
  await page.getByRole('button', { name: 'Create Request' }).click();
  await expect(page.getByText('Requested C4 rubber contact strip.')).toBeVisible();
  await page.getByRole('button', { name: 'Save Keyboard Job' }).click();
  await expect(page.getByText(/Saved keyboard job .*/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'C4, Dead Rubber Contact' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'D4, Missing Note Off' })).toBeVisible();
  await expect(page.getByLabel('Raw MIDI Diagnostic Log')).toHaveValue(/velocity=118/);
  await expect(page.getByLabel('Run a slow and fast full-key sweep for trigger and velocity consistency status')).toHaveValue('Attention');
  await expect(page.getByText('C4 rubber contact strip', { exact: true })).toBeVisible();
});

test('continues a MIDI batch after one finding cannot be confirmed', async ({ page }) => {
  const suffix = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer').fill('Korg');
  await page.getByLabel('Model', { exact: true }).fill(`MIDI Recovery Keyboard ${suffix}`);
  await page.getByLabel('Reported Symptoms / Customer Request').fill('MIDI batch partial-save regression fixture.');
  await page.getByRole('button', { name: 'Create Keyboard Work Order' }).click();

  let insertCount = 0;
  await page.route('**/rest/v1/key_damage_map*', async (route) => {
    if (route.request().method() === 'POST' && ++insertCount === 1) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      return;
    }
    await route.continue();
  });

  try {
    await page.getByLabel('Raw MIDI Diagnostic Log').fill('NOTE_ON ch=1 note=60 velocity=0\nNOTE_ON ch=1 note=62 velocity=118');
    await page.getByRole('button', { name: 'Apply MIDI Findings' }).click();

    await expect(page.getByText('Applied 1 of 2 MIDI findings. 1 could not be confirmed; reload and retry the remaining findings.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'D4, Missing Note Off' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'C4, MIDI preview: Zero Velocity Trigger' })).toBeVisible();
  } finally {
    await page.unroute('**/rest/v1/key_damage_map*');
  }
});

test('rejects concurrent creation of the same per-key finding', async ({ context, page }) => {
  const uniqueModel = `Concurrent Key Map ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard Repair' }).click();
  await page.getByLabel('Existing Customer').selectOption({ label: 'FicticiousJoe Customer 19' });
  await page.getByLabel('Manufacturer').fill('Korg');
  await page.getByLabel('Model', { exact: true }).fill(uniqueModel);
  await page.getByLabel('Reported Symptoms / Customer Request').fill('Per-key concurrency regression fixture.');
  await page.getByRole('button', { name: 'Create Keyboard Work Order' }).click();

  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await secondPage.getByRole('button', { name: 'Keyboard Repair' }).click();
  await secondPage.getByRole('button', { name: new RegExp(uniqueModel) }).click();

  await page.getByRole('button', { name: 'C4, no finding' }).click();
  await secondPage.getByRole('button', { name: 'C4, no finding' }).click();
  await page.getByLabel('Finding Notes').fill('First technician finding wins.');
  await secondPage.getByLabel('Finding Notes').fill('Stale second technician finding.');
  await page.getByRole('button', { name: 'Save Key Finding' }).click();
  await expect(page.getByText('Saved C4 diagnostic finding.')).toBeVisible();
  await secondPage.getByRole('button', { name: 'Save Key Finding' }).click();
  await expect(secondPage.getByText(/changed in another session/)).toBeVisible();

  await secondPage.getByRole('button', { name: 'Reload Findings' }).click();
  await secondPage.getByRole('button', { name: 'C4, Stuck Key' }).click();
  await expect(secondPage.getByLabel('Finding Notes')).toHaveValue('First technician finding wins.');
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
