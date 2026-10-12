import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'

import type { Booking } from '../../api/client'
import { bookingsUpcoming } from '../../api/client'
import { formatSlotDateLabel, formatSlotTime } from '../Book/dates'
import { formatDuration } from '../Book/duration'

/**
 * Раздел «Предстоящие события» — взгляд владельца: единый список будущих
 * встреч всех типов событий, отсортированный сервером по времени начала.
 * Сервер скрывает прошедшие записи и оставляет записи мягко удалённых типов.
 */
export function EventsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    bookingsUpcoming()
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.error || !Array.isArray(result.data)) {
          setLoadFailed(true)
          return
        }
        setBookings(result.data)
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

  return (
    <Box component="main" py="xl">
      <Container size="lg">
        <Stack gap="lg">
          <Stack gap="xs">
            <Title order={1}>Предстоящие события</Title>
            <Text c="dimmed">Ближайшие встречи всех типов событий по времени начала.</Text>
          </Stack>

          {loadFailed ? (
            <Alert color="red" title="Не удалось загрузить встречи">
              Попробуйте обновить страницу позже.
            </Alert>
          ) : null}

          {!loadFailed && bookings === null ? <Loader aria-label="Загрузка встреч" /> : null}

          {bookings ? (
            <Stack gap="md">
              {bookings.length === 0 ? <Text c="dimmed">Пока нет предстоящих встреч.</Text> : null}

              {bookings.map((booking) => (
                <Card key={booking.id} withBorder padding="lg" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={4}>
                        <Title order={2} size="h4">
                          {booking.eventType.name}
                        </Title>
                        <Text>
                          {formatSlotDateLabel(booking.startsAt)},{' '}
                          {formatSlotTime(booking.startsAt)}
                        </Text>
                      </Stack>
                      <Badge size="lg" variant="light" color="orange">
                        {formatDuration(booking.eventType.durationMinutes)}
                      </Badge>
                    </Group>

                    <Stack gap={2}>
                      <Text fw={500}>{booking.guestName}</Text>
                      <Text c="dimmed">{booking.guestEmail}</Text>
                      {booking.comment ? <Text>{booking.comment}</Text> : null}
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Container>
    </Box>
  )
}
