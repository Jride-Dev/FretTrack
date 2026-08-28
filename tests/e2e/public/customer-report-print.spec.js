import { expect, test } from '@playwright/test';

test('isolated customer report keeps saved markers aligned in print media', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await page.goto('/tests/fixtures/customer-report-print.html');

  const report = page.locator('.print-damage-report');
  await expect(report).toBeVisible();
  await expect(report.getByRole('heading', { name: 'Service and Condition Report' })).toBeVisible();
  await expect(report.locator('.print-damage-marker')).toHaveCount(3);
  await expect(report.getByText('Small finish chip at lower bout.')).toBeVisible();

  const geometry = await report.locator('.print-damage-map-stage').evaluate((stage) => {
    const stageRect = stage.getBoundingClientRect();
    return Array.from(stage.querySelectorAll('.print-damage-marker')).map((marker) => {
      const markerRect = marker.getBoundingClientRect();
      return {
        x: ((markerRect.left + markerRect.width / 2 - stageRect.left) / stageRect.width) * 100,
        y: ((markerRect.top + markerRect.height / 2 - stageRect.top) / stageRect.height) * 100
      };
    });
  });

  const expected = [{ x: 25, y: 36 }, { x: 52, y: 57 }, { x: 78, y: 24 }];
  geometry.forEach((actual, index) => {
    expect(Math.abs(actual.x - expected[index].x)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(actual.y - expected[index].y)).toBeLessThanOrEqual(0.2);
  });

  const overflow = await report.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('customer report does not present marks when the condition image fails to load', async ({ page }) => {
  await page.route('**/instruments/elec_Front.png', (route) => route.fulfill({
    status: 404,
    contentType: 'text/plain',
    body: 'Condition image unavailable'
  }));
  await page.emulateMedia({ media: 'print' });
  await page.goto('/tests/fixtures/customer-report-print.html');

  const report = page.locator('.print-damage-report');
  await expect(report.getByText('A condition image was recorded, but it is not currently available for this report.')).toBeVisible();
  await expect(report.locator('.print-damage-marker')).toHaveCount(0);
  await expect(report.locator('.print-damage-table')).toHaveCount(0);
  await expect(report.getByText('Small finish chip at lower bout.')).toHaveCount(0);
});
