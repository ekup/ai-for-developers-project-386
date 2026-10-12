import { Button, SimpleGrid, Stack, Text } from '@mantine/core'

import { formatDateLabel, formatWeekdayShort, parseISODate } from './dates'

type DateCalendarProps = {
  /** Даты окна записи в формате `YYYY-MM-DD`. */
  dates: string[]
  /** Выбранная дата. */
  selected: string
  /** Обработчик выбора даты. */
  onSelect: (date: string) => void
}

/**
 * DateCalendar — сетка дат окна записи. Показывает только даты внутри окна и
 * не позволяет выбрать что-то за его пределами.
 */
export function DateCalendar({ dates, selected, onSelect }: DateCalendarProps) {
  return (
    <SimpleGrid cols={{ base: 3, sm: 7 }} spacing="xs" role="group" aria-label="Календарь">
      {dates.map((date) => {
        const isSelected = date === selected

        return (
          <Button
            key={date}
            variant={isSelected ? 'light' : 'default'}
            color="orange"
            onClick={() => onSelect(date)}
            aria-label={formatDateLabel(date)}
            aria-pressed={isSelected}
            h="auto"
            py="xs"
          >
            <Stack gap={0} align="center">
              <Text size="xs" c={isSelected ? 'orange.7' : 'dimmed'}>
                {formatWeekdayShort(date)}
              </Text>
              <Text fw={700}>{parseISODate(date).getDate()}</Text>
            </Stack>
          </Button>
        )
      })}
    </SimpleGrid>
  )
}
