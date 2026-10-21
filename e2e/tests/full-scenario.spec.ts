import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// runId — уникальный суффикс прогона; на каждую попытку добавляется ещё один,
// чтобы ретрай не упирался в данные, созданные предыдущей попыткой в той же БД.
function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

const runId = `${Date.now()}-${uniqueSuffix()}`

// Пояс записи фиксирован продуктово (docs/adr/0003): и сервер, и браузер
// работают в Europe/Moscow, поэтому «сейчас» считаем в нём же.
const BOOKING_TIMEZONE = 'Europe/Moscow'

// BUFFER_MINUTES — запас от текущего момента для слота «на сегодня»: пока
// тест дойдёт до /events, слот не должен успеть стать прошедшим.
const BUFFER_MINUTES = 10

type MoscowClock = {
  minutes: number
}

/** moscowClock возвращает текущее время суток в поясе записи. */
function moscowClock(now = new Date()): MoscowClock {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: BOOKING_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return { minutes: Number(value('hour')) * 60 + Number(value('minute')) }
}

/** toMinutes переводит время слота `HH:MM` в минуты от начала суток. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * pickFirstAvailableSlot выбирает первый доступный слот, перебирая даты
 * календаря из DOM. Дата не захардкожена, порядок типов событий не важен.
 *
 * Для сегодняшней даты слоты ближе BUFFER_MINUTES к текущему моменту
 * пропускаются: иначе запись может перестать быть предстоящей, пока тест
 * открывает /events.
 */
async function pickFirstAvailableSlot(page: Page): Promise<{ time: string; dateLabel: string }> {
  const dates = page.getByRole('group', { name: 'Календарь' }).getByRole('button')
  const dateCount = await dates.count()
  expect(dateCount, 'В календаре нет ни одной даты окна записи').toBeGreaterThan(0)

  const clock = moscowClock()
  const minMinutes = clock.minutes + BUFFER_MINUTES

  for (let dateIndex = 0; dateIndex < dateCount; dateIndex += 1) {
    const dateButton = dates.nth(dateIndex)
    const dateLabel = (await dateButton.getAttribute('aria-label')) ?? ''
    await dateButton.click()

    await expect(page.getByRole('heading', { name: 'Свободные слоты' })).toBeVisible()
    await expect(
      page
        .getByRole('button', { name: /^\d{2}:\d{2}$/ })
        .first()
        .or(page.getByText('Нет свободных слотов на эту дату.')),
    ).toBeVisible()

    const slots = page.getByRole('button', { name: /^\d{2}:\d{2}$/ })
    const slotCount = await slots.count()
    // Окно записи начинается с сегодняшнего дня, поэтому первая дата — сегодня.
    const today = dateIndex === 0

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const slotButton = slots.nth(slotIndex)
      const time = ((await slotButton.textContent()) ?? '').trim()

      if (today && toMinutes(time) < minMinutes) {
        continue
      }

      await slotButton.click()
      return { time, dateLabel }
    }
  }

  throw new Error(
    'В окне записи нет свободных слотов: сценарий не может завершиться. ' +
      'Проверьте рабочие часы, занятость слотов и пояс записи.',
  )
}

// getEventTypeCard находит карточку гостевого каталога по названию типа
// события, не полагаясь на CSS-классы Mantine и порядок карточек.
function getEventTypeCard(page: Page, name: string) {
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name }) })
    .filter({ has: page.getByRole('link', { name: 'Выбрать время' }) })
    .last()
}

test('гость проходит путь от лендинга до записи в предстоящих встречах', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeVisible()

  await page.getByRole('main').getByRole('link', { name: 'Записаться' }).click()
  await expect(page).toHaveURL(/\/book$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Записаться' })).toBeVisible()

  const eventTypeName = (
    (await page.getByRole('heading', { level: 2 }).first().textContent()) ?? ''
  ).trim()
  expect(eventTypeName, 'В каталоге нет ни одного типа события').not.toBe('')

  await page.getByRole('link', { name: 'Выбрать время' }).first().click()
  await expect(page).toHaveURL(/\/book\/\d+$/)
  await expect(page.getByRole('heading', { level: 1, name: eventTypeName })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Свободные слоты' })).toBeVisible()

  const slot = await pickFirstAvailableSlot(page)
  await expect(page.getByRole('heading', { name: 'Ваши данные' })).toBeVisible()

  const attemptId = `${runId}-${uniqueSuffix()}`
  const guestName = `Гость E2E ${attemptId}`
  const guestEmail = `e2e-guest-${attemptId}@example.com`
  const comment = `Комментарий E2E ${attemptId}`

  await page.getByLabel('Имя').fill(guestName)
  await page.getByLabel('Email').fill(guestEmail)
  await page.getByLabel('Комментарий').fill(comment)
  await page.getByRole('button', { name: 'Записаться' }).click()

  await expect(page.getByText('Запись создана', { exact: true })).toBeVisible()
  const details = page.getByRole('region', { name: 'Детали записи' })
  await expect(details).toBeVisible()
  await expect(details).toContainText(eventTypeName)
  await expect(details).toContainText(slot.dateLabel)
  await expect(details).toContainText(slot.time)
  await expect(details).toContainText(guestName)
  await expect(details).toContainText(guestEmail)
  await expect(details).toContainText(comment)

  // Прямой переход на /events проверяет SPA-fallback бэкенда.
  await page.goto('/events')
  await expect(page.getByRole('heading', { level: 1, name: 'Предстоящие события' })).toBeVisible()

  const main = page.getByRole('main')
  await expect(main).toContainText(eventTypeName)
  await expect(main).toContainText(guestName)
  await expect(main).toContainText(guestEmail)
  await expect(main).toContainText(comment)
})

test('владелец создаёт тип события и видит его в гостевом каталоге', async ({ page }) => {
  await page.goto('/admin')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Управление типами событий' }),
  ).toBeVisible()

  // Суффикс на попытку: ретрай не должен упираться в одноимённый тип,
  // созданный предыдущей попыткой в той же БД.
  const attemptId = `${runId}-${uniqueSuffix()}`
  const name = `E2E звонок ${attemptId}`
  const description = `Описание E2E ${attemptId}`
  const form = page.getByRole('form', { name: 'Новый тип события' })

  await form.getByLabel('Название').fill(name)
  await form.getByLabel('Описание').fill(description)
  await form.getByLabel('Длительность, минут').fill('45')
  await form.getByRole('button', { name: 'Создать' }).click()

  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()

  await page.goto('/book')
  await expect(page.getByRole('heading', { level: 1, name: 'Записаться' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
  await expect(page.getByText(description, { exact: true })).toBeVisible()

  const card = getEventTypeCard(page, name)
  await card.getByRole('link', { name: 'Выбрать время' }).click()
  await expect(page).toHaveURL(/\/book\/\d+$/)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

  // Повторный заход по прямому адресу страницы типа события проверяет
  // SPA-fallback для /book/:id.
  await page.goto(page.url())
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Свободные слоты' })).toBeVisible()
})
