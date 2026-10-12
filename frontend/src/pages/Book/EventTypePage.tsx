import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'

import type { BookingWindow, EventType } from '../../api/client'
import { bookingsWindow, eventTypesList, eventTypesSlots } from '../../api/client'
import { DateCalendar } from './DateCalendar'
import { dateRange, formatSlotTime } from './dates'
import { formatDuration } from './duration'

// slotsResult хранит ответ на запрос слотов вместе с датой, к которой он
// относится, — так не нужно сбрасывать состояние при смене даты.
type SlotsResult =
  { status: 'ok'; date: string; slots: string[] } | { status: 'error'; date: string }

/**
 * Страница типа события для гостя: календарь в пределах окна записи и
 * свободные слоты выбранной даты.
 *
 * Окно записи приходит с сервера, поэтому «сегодня» и последний доступный
 * день не зависят от часов браузера.
 */
export function EventTypePage() {
  const { id } = useParams()
  const eventTypeId = Number(id)

  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const [window, setWindow] = useState<BookingWindow | null>(null)
  const [windowFailed, setWindowFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null)

  useEffect(() => {
    let cancelled = false

    eventTypesList()
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.error || !Array.isArray(result.data)) {
          setLoadFailed(true)
          return
        }
        setEventTypes(result.data)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    bookingsWindow()
      .then((result) => {
        if (cancelled) {
          return
        }
        const data = result.data
        if (
          result.error ||
          !data ||
          typeof data.start !== 'string' ||
          typeof data.end !== 'string'
        ) {
          setWindowFailed(true)
          return
        }
        setWindow(data)
      })
      .catch(() => {
        if (!cancelled) {
          setWindowFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const eventType = eventTypes?.find((item) => item.id === eventTypeId) ?? null
  const dates = useMemo(() => (window ? dateRange(window.start, window.end) : []), [window])
  const selectedDate = selected ?? dates[0] ?? null

  useEffect(() => {
    if (!eventType || !selectedDate) {
      return
    }

    let cancelled = false

    eventTypesSlots({ path: { id: eventType.id }, query: { date: selectedDate } })
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.error || !result.data || !Array.isArray(result.data.slots)) {
          setSlotsResult({ status: 'error', date: selectedDate })
          return
        }
        setSlotsResult({ status: 'ok', date: selectedDate, slots: result.data.slots })
      })
      .catch(() => {
        if (!cancelled) {
          setSlotsResult({ status: 'error', date: selectedDate })
        }
      })

    return () => {
      cancelled = true
    }
  }, [eventType, selectedDate])

  const currentSlots = slotsResult?.date === selectedDate ? slotsResult : null
  const loading = !loadFailed && !windowFailed && (eventTypes === null || window === null)
  const notFound = !loadFailed && !windowFailed && eventTypes !== null && !eventType

  return (
    <Box component="main" py="xl">
      <Container size="lg">
        <Stack gap="lg">
          {loadFailed ? (
            <Alert color="red" title="Не удалось загрузить тип события">
              Попробуйте обновить страницу позже.
            </Alert>
          ) : null}

          {windowFailed ? (
            <Alert color="red" title="Не удалось загрузить календарь">
              Попробуйте обновить страницу позже.
            </Alert>
          ) : null}

          {loading ? <Loader aria-label="Загрузка типа события" /> : null}

          {notFound ? (
            <Alert color="orange" title="Тип события не найден">
              Возможно, его удалили. Вернитесь к списку и выберите другой.
            </Alert>
          ) : null}

          {eventType && window && selectedDate ? (
            <>
              <Stack gap="xs">
                <Title order={1}>{eventType.name}</Title>
                <Text c="dimmed">{eventType.description}</Text>
                <Badge size="lg" variant="light" color="orange" w="fit-content">
                  {formatDuration(eventType.durationMinutes)}
                </Badge>
              </Stack>

              <DateCalendar dates={dates} selected={selectedDate} onSelect={setSelected} />

              <Stack gap="sm">
                <Title order={2} size="h4">
                  Свободные слоты
                </Title>

                {currentSlots?.status === 'error' ? (
                  <Alert color="red" title="Не удалось загрузить слоты">
                    Попробуйте выбрать дату ещё раз.
                  </Alert>
                ) : null}

                {!currentSlots ? <Loader aria-label="Загрузка слотов" /> : null}

                {currentSlots?.status === 'ok' && currentSlots.slots.length === 0 ? (
                  <Text c="dimmed">Нет свободных слотов на эту дату.</Text>
                ) : null}

                {currentSlots?.status === 'ok' && currentSlots.slots.length > 0 ? (
                  <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="xs">
                    {currentSlots.slots.map((slot) => (
                      <Button key={slot} variant="light" color="orange" w="100%">
                        {formatSlotTime(slot)}
                      </Button>
                    ))}
                  </SimpleGrid>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Container>
    </Box>
  )
}
