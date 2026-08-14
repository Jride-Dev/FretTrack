import { expect, test } from '@playwright/test';

test('loads the FretTrack sign-in screen against the local test backend', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'FretTrack' })).toBeVisible();
  await expect(page.getByText('Sign in to access shop work orders and customer records.')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});
