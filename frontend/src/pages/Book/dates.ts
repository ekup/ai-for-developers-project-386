// Работа с календарными датами окна записи.
//
// Даты передаются строками `YYYY-MM-DD` без конвертаций между часовыми
// поясами: окно записи задаёт сервер, а браузер только раскладывает его на дни.

const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

const MONTH_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

/** toISODate форматирует локальную дату как `YYYY-MM-DD`. */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** parseISODate разбирает `YYYY-MM-DD` в локальную дату. */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** addDays возвращает дату через указанное число календарных дней. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * dateRange возвращает дни от `startISO` до `endISO` включительно.
 */
export function dateRange(startISO: string, endISO: string): string[] {
  const end = parseISODate(endISO)
  const dates: string[] = []

  for (let cursor = parseISODate(startISO); cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(toISODate(cursor))
  }

  return dates
}

/** formatDateLabel возвращает подпись даты, например «13 октября, вт». */
export function formatDateLabel(iso: string): string {
  const date = parseISODate(iso)
  return `${date.getDate()} ${MONTH_GENITIVE[date.getMonth()]}, ${WEEKDAY_SHORT[date.getDay()]}`
}

/** formatWeekdayShort возвращает короткое имя дня недели, например «вт». */
export function formatWeekdayShort(iso: string): string {
  return WEEKDAY_SHORT[parseISODate(iso).getDay()]
}

/**
 * formatSlotTime извлекает время `HH:MM` из старта слота как есть, без
 * конвертации в часовой пояс браузера (время ведётся в серверном поясе).
 */
export function formatSlotTime(slot: string): string {
  const match = /T(\d{2}:\d{2})/.exec(slot)
  return match ? match[1] : slot
}

/**
 * formatSlotDateLabel извлекает дату из старта слота и форматирует её как
 * «13 октября, вт», также без конвертации в часовой пояс браузера.
 */
export function formatSlotDateLabel(slot: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(slot)
  return match ? formatDateLabel(match[1]) : slot
}
