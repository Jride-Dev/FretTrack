import { expect, test } from '@playwright/test';

test('opens guitar jobs in the focused bench and retains the complete work-order bridge', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
  await page.getByRole('row', { name: /Open job .* for FicticiousJoe Customer 1$/ }).click();

  await expect(page.getByText('Guitar work order', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guitar Bench' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Work Order' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guitar Identity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tech Details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Damage Map' })).toBeVisible();
  await expect(page.getByText('Amplifier work order', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Keyboard work order', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();
  await expect(page.getByRole('tab', { name: 'Parts & Billing' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Work Order, Parts & Payments' })).toHaveAttribute('aria-pressed', 'true');
  const serviceQuantity = page.getByRole('heading', { name: 'Services' }).locator('..').getByPlaceholder('Qty');
  await expect(serviceQuantity).toHaveAttribute('step', '1');
  await serviceQuantity.fill('2.5');
  await expect(serviceQuantity).toHaveValue('2');

  await page.getByRole('button', { name: 'Guitar Bench' }).click();
  await expect(page.getByText('Guitar work order', { exact: true })).toBeVisible();
});

test('opens the dedicated estimates queue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Estimates', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estimates' })).toBeVisible();
  await expect(page.getByLabel('Estimate status filter')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estimate queue' })).toBeVisible();
});

test('records an audited estimate decision and unlocks only through a new draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Current Jobs', exact: true }).click();
  await page.getByRole('row', { name: /Open job .* for FicticiousJoe Customer 2$/ }).click();
  await page.getByRole('button', { name: 'Work Order, Parts & Payments' }).click();
  await expect(page.getByRole('tab', { name: 'Parts & Billing' })).toHaveAttribute('aria-selected', 'true');

  const estimateNote = page.getByLabel('Estimate audit note');
  await estimateNote.fill('Estimate emailed to the customer');
  await page.getByRole('button', { name: 'Mark Estimate Sent' }).click();
  await expect(page.getByText(/Estimate revision \d+: Sent/)).toBeVisible();
  await page.getByRole('button', { name: 'Create Customer Link' }).click();
  const customerEstimateLink = page.getByLabel('Customer estimate link');
  await expect(customerEstimateLink).toHaveValue(/\?estimate=[0-9a-f]{64}$/);
  await expect(page.getByRole('link', { name: 'Open customer view' })).toHaveAttribute('href', /\?estimate=[0-9a-f]{64}$/);
  await expect(page.getByRole('button', { name: 'Email Estimate' })).toBeVisible();
  await page.getByRole('button', { name: 'Email Estimate' }).click();
  await expect(page.getByRole('dialog', { name: 'Email Estimate' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Email Estimate' }).getByText('Included Estimate').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close Email Estimate' }).click();
  await expect(page.getByPlaceholder('Part name or description')).toBeDisabled();

  await estimateNote.fill('Customer approved by telephone');
  await page.getByRole('button', { name: 'Record Approval' }).click();
  await expect(page.getByText(/Estimate revision \d+: Approved/)).toBeVisible();

  await estimateNote.fill('Preparing an updated repair scope');
  await page.getByRole('button', { name: 'Start Revised Estimate' }).click();
  await expect(page.getByRole('button', { name: 'Mark Estimate Sent' })).toBeVisible();
  await expect(page.getByPlaceholder('Part name or description')).toBeEnabled();
});
