import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router'
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'

import type { Booking, BookingWindow, EventType } from '../../api/client'
import { bookingsCreate, bookingsWindow, eventTypesList, eventTypesSlots } from '../../api/client'
import { DateCalendar } from './DateCalendar'
import { dateRange, formatSlotDateLabel, formatSlotTime } from './dates'
import { formatDuration } from './duration'

// slotsResult хранит ответ на запрос слотов вместе с датой, к которой он
// относится, — так не нужно сбрасывать состояние при смене даты.
type SlotsResult =
  { status: 'ok'; date: string; slots: string[] } | { status: 'error'; date: string }

// submitError различает занятость слота (её нужно показать отдельно) и прочие
// сбои создания записи.
type SubmitError = 'conflict' | 'other'

/**
 * Страница типа события для гостя: календарь в пределах окна записи, свободные
 * слоты выбранной даты, форма записи и подтверждение созданной записи.
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
  const [slotsReload, setSlotsReload] = useState(0)

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)

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
  }, [eventType, selectedDate, slotsReload])

  const currentSlots = slotsResult?.date === selectedDate ? slotsResult : null
  const loading = !loadFailed && !windowFailed && (eventTypes === null || window === null)
  const notFound = !loadFailed && !windowFailed && eventTypes !== null && !eventType

  function handleSelectDate(date: string) {
    setSelected(date)
    setSelectedSlot(null)
    setBooking(null)
    setSubmitError(null)
  }

  function handleSelectSlot(slot: string) {
    setSelectedSlot(slot)
    setBooking(null)
    setSubmitError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!eventType || !selectedSlot) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const trimmedComment = comment.trim()

    try {
      const result = await bookingsCreate({
        body: {
          eventTypeId: eventType.id,
          startsAt: selectedSlot,
          guestName,
          guestEmail,
          comment: trimmedComment === '' ? undefined : trimmedComment,
        },
      })

      if (result.error || !result.data) {
        if (result.response?.status === 409) {
          // Слот заняли между показом и отправкой: убираем его из списка и
          // просим гостя выбрать другое время.
          setSubmitError('conflict')
          setSelectedSlot(null)
          setSlotsReload((count) => count + 1)
        } else {
          setSubmitError('other')
        }
        return
      }

      setBooking(result.data)
      setSelectedSlot(null)
      // Созданная запись занимает слот — обновляем список свободных.
      setSlotsReload((count) => count + 1)
    } catch {
      setSubmitError('other')
    } finally {
      setSubmitting(false)
    }
  }

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

              <DateCalendar dates={dates} selected={selectedDate} onSelect={handleSelectDate} />

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
                      <Button
                        key={slot}
                        variant={slot === selectedSlot ? 'filled' : 'light'}
                        color="orange"
                        w="100%"
                        onClick={() => handleSelectSlot(slot)}
                      >
                        {formatSlotTime(slot)}
                      </Button>
                    ))}
                  </SimpleGrid>
                ) : null}
              </Stack>

              {submitError === 'conflict' ? (
                <Alert color="orange" title="Это время уже занято">
                  Пока вы заполняли форму, слот заняли. Выберите другое время.
                </Alert>
              ) : null}

              {submitError === 'other' ? (
                <Alert color="red" title="Не удалось создать запись">
                  Попробуйте ещё раз.
                </Alert>
              ) : null}

              {selectedSlot && !booking ? (
                <Paper withBorder p="lg" radius="md" component="form" onSubmit={handleSubmit}>
                  <Stack gap="sm">
                    <Title order={2} size="h4">
                      Ваши данные
                    </Title>
                    <TextInput
                      label="Имя"
                      value={guestName}
                      onChange={(event) => setGuestName(event.currentTarget.value)}
                      required
                    />
                    <TextInput
                      label="Email"
                      type="email"
                      value={guestEmail}
                      onChange={(event) => setGuestEmail(event.currentTarget.value)}
                      required
                    />
                    <Textarea
                      label="Комментарий"
                      value={comment}
                      onChange={(event) => setComment(event.currentTarget.value)}
                    />
                    <Button type="submit" color="orange" loading={submitting} w="fit-content">
                      Записаться
                    </Button>
                  </Stack>
                </Paper>
              ) : null}

              {booking ? (
                <Alert color="green" title="Запись создана">
                  <Stack gap={4} role="region" aria-label="Детали записи">
                    <Text fw={500}>{booking.eventType.name}</Text>
                    <Text>
                      {formatSlotDateLabel(booking.startsAt)}, {formatSlotTime(booking.startsAt)}
                    </Text>
                    <Text c="dimmed">{formatDuration(booking.eventType.durationMinutes)}</Text>
                    <Text>{booking.guestName}</Text>
                    <Text>{booking.guestEmail}</Text>
                    {booking.comment ? <Text>{booking.comment}</Text> : null}
                  </Stack>
                </Alert>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Container>
    </Box>
  )
}
