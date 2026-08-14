import { mkdir } from 'node:fs/promises';
import { expect, test as setup } from '@playwright/test';

const ownerStorageState = 'playwright/.auth/test1-owner.json';
const ownerEmail = process.env.PLAYWRIGHT_OWNER_EMAIL || 'test1.owner@frettrack.local';
const ownerPassword = process.env.PLAYWRIGHT_OWNER_PASSWORD || 'FretTrackTest123!';
const ukOwnerStorageState = 'playwright/.auth/test2-owner.json';
const ukOwnerEmail = process.env.PLAYWRIGHT_UK_OWNER_EMAIL || 'test2.owner@frettrack.local';
const ukOwnerPassword = process.env.PLAYWRIGHT_UK_OWNER_PASSWORD || ownerPassword;

async function authenticateOwner(page, { email, password, shopName, storageState }) {
  await mkdir('playwright/.auth', { recursive: true });
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('button', { name: 'Sign Out' }).first()).toBeVisible();
  await expect(page.getByText(shopName, { exact: true })).toBeVisible();
  await page.context().storageState({ path: storageState });
}

setup('authenticate the local US test-shop owner', async ({ page }) => {
  await authenticateOwner(page, {
    email: ownerEmail,
    password: ownerPassword,
    shopName: 'test1 shop',
    storageState: ownerStorageState,
  });
});

setup('authenticate the local UK test-shop owner', async ({ page }) => {
  await authenticateOwner(page, {
    email: ukOwnerEmail,
    password: ukOwnerPassword,
    shopName: 'test2 shop',
    storageState: ukOwnerStorageState,
  });
});
