import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'

import type { EventType } from '../../api/client'
import { eventTypesList } from '../../api/client'
import { formatDuration } from './duration'

/**
 * Раздел «Записаться»: список активных типов событий для гостя.
 */
export function BookPage() {
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    eventTypesList()
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.error || !Array.isArray(result.data)) {
          setFailed(true)
          return
        }
        setEventTypes(result.data)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
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
            <Title order={1}>Записаться</Title>
            <Text c="dimmed">
              Выберите тип события — свободные слоты появятся на следующем шаге.
            </Text>
          </Stack>

          {failed ? (
            <Alert color="red" title="Не удалось загрузить типы событий">
              Попробуйте обновить страницу позже.
            </Alert>
          ) : null}

          {!failed && eventTypes === null ? <Loader aria-label="Загрузка типов событий" /> : null}

          {eventTypes ? (
            <Stack gap="md">
              {eventTypes.length === 0 ? (
                <Text c="dimmed">Пока нет доступных типов событий.</Text>
              ) : null}
              {eventTypes.map((eventType) => (
                <Card key={eventType.id} withBorder padding="lg" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={4}>
                        <Title order={2} size="h4">
                          {eventType.name}
                        </Title>
                        <Text c="dimmed">{eventType.description}</Text>
                      </Stack>
                      <Badge size="lg" variant="light" color="orange">
                        {formatDuration(eventType.durationMinutes)}
                      </Badge>
                    </Group>
                    <Button
                      component={Link}
                      to={`/book/${eventType.id}`}
                      color="orange"
                      variant="light"
                      w="fit-content"
                    >
                      Выбрать время
                    </Button>
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
