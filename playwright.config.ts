import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: [
    {
      command: 'cmd /c "set PORT=3000&& set HOST=127.0.0.1&& set DATABASE_PATH=.e2e\\server.sqlite&& set TEST_MODE=1&& npm run dev:server"',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'cmd /c "set VITE_API_TARGET=http://127.0.0.1:3000&& npm run dev:web -- --host 127.0.0.1 --port 4173"',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
