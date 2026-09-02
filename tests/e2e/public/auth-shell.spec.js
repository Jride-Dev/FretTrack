import { expect, test } from '@playwright/test';

test('loads the FretTrack sign-in screen against the local test backend', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'FretTrack' })).toBeVisible();
  await expect(page.getByText('Sign in to access shop work orders and customer records.')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('opens account creation from the public free-trial URL', async ({ page }) => {
  await page.goto('/?signup=1');

  await expect(page.getByText('Create your account, confirm your email, and start a free 14-day Pro trial. No card is required.')).toBeVisible();
  await expect(page.getByLabel('Confirm Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).not.toBeVisible();
});
