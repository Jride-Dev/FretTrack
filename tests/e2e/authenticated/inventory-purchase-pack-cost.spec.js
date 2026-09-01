import { expect, test } from '@playwright/test';

test('prices a vendor pack once and derives the inventory-each cost', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Purchase Orders', exact: true }).click();

  const item = page.locator('.purchase-order-item-block').first();
  await item.getByLabel('Purchase unit').selectOption('pack');
  await item.getByLabel('Packages ordered').fill('1');
  await item.getByLabel('Items inside one package').fill('5');
  await item.getByLabel('Whole package price').fill('19.40');

  await expect(item).toContainText('Order: 1 Pack, 5 items in each (5 inventory items total).');
  await expect(item).toContainText('Vendor charge: $19.40.');
  await expect(item).toContainText('Calculated inventory cost: $3.88 each.');

  await item.getByLabel('Packages ordered').fill('5');
  await expect(item).toContainText('Order: 5 Packs, 5 items in each (25 inventory items total).');
  await expect(item).toContainText('Vendor charge: $97.00.');
});
