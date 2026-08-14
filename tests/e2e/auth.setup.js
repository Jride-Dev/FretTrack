import { mkdir } from 'node:fs/promises';
import { expect, test as setup } from '@playwright/test';

const ownerStorageState = 'playwright/.auth/test1-owner.json';
const ownerEmail = process.env.PLAYWRIGHT_OWNER_EMAIL || 'test1.owner@frettrack.local';
const ownerPassword = process.env.PLAYWRIGHT_OWNER_PASSWORD || 'FretTrackTest123!';

setup('authenticate the local test-shop owner', async ({ page }) => {
  await mkdir('playwright/.auth', { recursive: true });
  await page.goto('/');
  await page.getByLabel('Email').fill(ownerEmail);
  await page.getByLabel('Password').fill(ownerPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('button', { name: 'Sign Out' }).first()).toBeVisible();
  await expect(page.getByText('test1 shop', { exact: true })).toBeVisible();
  await page.context().storageState({ path: ownerStorageState });
});
