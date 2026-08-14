// @ts-check
import { defineConfig, devices } from '@playwright/test';

const localBaseUrl = 'http://127.0.0.1:5173';
const ownerStorageState = 'playwright/.auth/test1-owner.json';
const ukOwnerStorageState = 'playwright/.auth/test2-owner.json';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: localBaseUrl,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/
    },
    {
      name: 'public-chromium',
      testMatch: '**/public/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'owner-chromium',
      testMatch: '**/authenticated/**/*.spec.js',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: ownerStorageState
      }
    },
    {
      name: 'uk-owner-chromium',
      testMatch: '**/uk-authenticated/**/*.spec.js',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: ukOwnerStorageState
      }
    }
  ],
  webServer: {
    command: 'npm run dev:test -- --host 127.0.0.1',
    url: localBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
