import { defineConfig, devices } from '@playwright/test'

// E2E_PORT задаёт и адрес webServer, и baseURL — по умолчанию 18081, чтобы
// прогон не пересекался со smoke.sh, который занимает 18080.
const port = Number(process.env.E2E_PORT ?? 18081)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  // Сценарии делят одну свежую БД, поэтому идут последовательно.
  fullyParallel: false,
  workers: 1,
  // Один ретрай нужен, чтобы trace успел записаться (trace: on-first-retry).
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Скрипт собирает прод-путь (фронтенд + бинарник), поднимает сервер на
    // временной БД и гасит его вместе с каталогом по завершении.
    command: '../scripts/e2e-server.sh',
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Без этого Playwright убивает процесс SIGKILL и временная БД остаётся.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
})
