import { expect, test } from '@playwright/test';
import { openSeededJob } from '../helpers/jobNavigation.js';

test('Pro owner can access the scheduled email controls and drop-off template', async ({ page }) => {
  await openSeededJob(page);
  await page.getByRole('tab', { name: 'Print' }).click();

  await expect(page.getByText('Schedule Email', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Delivery date and time')).toBeEnabled();
  await page.getByLabel('Template').selectOption('drop_off_scheduled');
  await expect(page.getByLabel('Editable Message Preview')).toContainText('Your appointment is scheduled for');
});

test('scheduled email controls stay contained on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSeededJob(page);
  await page.getByRole('tab', { name: 'Print' }).click();

  const scheduling = page.locator('.message-scheduling');
  await expect(scheduling).toBeVisible();
  expect(await scheduling.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Schedule Email', exact: true })).toBeVisible();
});

test('an indeterminate scheduling retry reuses the same provider request ID', async ({ page }) => {
  const requests = [];
  await page.route('**/functions/v1/send-email', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON();
    requests.push(payload);
    const message = {
      id: 'a1000000-0000-4000-a000-000000000001',
      job_id: payload.job_id,
      channel: 'email',
      recipient: payload.to,
      subject: payload.subject,
      body: payload.body,
      template_key: payload.template_key,
      status: requests.length === 1 ? 'pending' : 'scheduled',
      provider: 'resend',
      provider_message_id: requests.length === 1 ? '' : 'provider-scheduled-one',
      request_id: payload.request_id,
      scheduled_at: payload.scheduled_at,
      created_at: new Date().toISOString()
    };

    await route.fulfill({
      status: requests.length === 1 ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(requests.length === 1
        ? {
          success: false,
          code: 'EMAIL_HISTORY_RECONCILIATION_REQUIRED',
          error: 'Message History is still awaiting reconciliation.',
          message
        }
        : { success: true, id: message.provider_message_id, scheduled: true, message })
    });
  });

  await openSeededJob(page);
  await page.getByRole('tab', { name: 'Print' }).click();
  await page.locator('.work-order-messages').getByLabel('Email opt-in', { exact: true }).check();
  const scheduledDate = new Date(Date.now() + 10 * 60 * 1000);
  const localScheduledDate = new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel('Delivery date and time').fill(localScheduledDate);

  await page.getByRole('button', { name: 'Schedule Email', exact: true }).click();
  await expect(page.getByText('Message History is still awaiting reconciliation.')).toBeVisible();
  await page.getByRole('button', { name: 'Schedule Email', exact: true }).click();
  await expect(page.getByText('Email scheduled with the delivery provider and added to message history.')).toBeVisible();

  expect(requests).toHaveLength(2);
  expect(requests[0].request_id).toBeTruthy();
  expect(requests[1].request_id).toBe(requests[0].request_id);
});
