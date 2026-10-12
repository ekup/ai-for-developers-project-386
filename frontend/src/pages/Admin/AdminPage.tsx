import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'

import type { EventType } from '../../api/client'
import {
  eventTypesCreate,
  eventTypesList,
  eventTypesRemove,
  eventTypesUpdate,
} from '../../api/client'
import { formatDuration } from '../Book/duration'

/**
 * Административная страница владельца: создание типов событий, правка их
 * названия и описания и мягкое удаление. Идентификатор назначает система,
 * длительность задаётся при создании и дальше не меняется.
 */
export function AdminPage() {
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState<string | number>('')
  const [creating, setCreating] = useState(false)
  const [createFailed, setCreateFailed] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [updating, setUpdating] = useState(false)
  const [editFailed, setEditFailed] = useState(false)

  const [removeFailed, setRemoveFailed] = useState(false)

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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setCreating(true)
    setCreateFailed(false)

    try {
      const result = await eventTypesCreate({
        body: {
          name: name.trim(),
          description: description.trim(),
          durationMinutes: Number(duration),
        },
      })

      if (result.error || !result.data) {
        setCreateFailed(true)
        return
      }

      const created = result.data
      setEventTypes((current) => [...(current ?? []), created])
      setName('')
      setDescription('')
      setDuration('')
    } catch {
      setCreateFailed(true)
    } finally {
      setCreating(false)
    }
  }

  function startEdit(eventType: EventType) {
    setEditingId(eventType.id)
    setEditName(eventType.name)
    setEditDescription(eventType.description)
    setEditFailed(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditFailed(false)
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingId === null) {
      return
    }

    setUpdating(true)
    setEditFailed(false)

    try {
      const result = await eventTypesUpdate({
        path: { id: editingId },
        body: { name: editName.trim(), description: editDescription.trim() },
      })

      if (result.error || !result.data) {
        setEditFailed(true)
        return
      }

      const updated = result.data
      setEventTypes((current) => (current ?? []).map((et) => (et.id === updated.id ? updated : et)))
      setEditingId(null)
    } catch {
      setEditFailed(true)
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete(id: number) {
    setRemoveFailed(false)

    try {
      const result = await eventTypesRemove({ path: { id } })

      if (result.error) {
        setRemoveFailed(true)
        return
      }

      setEventTypes((current) => (current ?? []).filter((et) => et.id !== id))
    } catch {
      setRemoveFailed(true)
    }
  }

  const loading = !loadFailed && eventTypes === null

  return (
    <Box component="main" py="xl">
      <Container size="lg">
        <Stack gap="lg">
          <Stack gap="xs">
            <Title order={1}>Управление типами событий</Title>
            <Text c="dimmed">
              Создавайте типы событий, правьте название и описание и убирайте ненужные. Гости видят
              изменения сразу.
            </Text>
          </Stack>

          {loadFailed ? (
            <Alert color="red" title="Не удалось загрузить типы событий">
              Попробуйте обновить страницу позже.
            </Alert>
          ) : null}

          {removeFailed ? (
            <Alert color="red" title="Не удалось удалить тип события">
              Попробуйте ещё раз.
            </Alert>
          ) : null}

          <Paper
            withBorder
            p="lg"
            radius="md"
            component="form"
            aria-label="Новый тип события"
            onSubmit={handleCreate}
          >
            <Stack gap="sm">
              <Title order={2} size="h4">
                Новый тип события
              </Title>

              {createFailed ? <Alert color="red">Не удалось создать тип события</Alert> : null}

              <TextInput
                label="Название"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                required
              />
              <TextInput
                label="Описание"
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
              <NumberInput
                label="Длительность, минут"
                value={duration}
                onChange={setDuration}
                min={1}
                required
              />
              <Button type="submit" color="orange" loading={creating} w="fit-content">
                Создать
              </Button>
            </Stack>
          </Paper>

          {loading ? <Loader aria-label="Загрузка типов событий" /> : null}

          {eventTypes ? (
            <Stack gap="md">
              {eventTypes.length === 0 ? <Text c="dimmed">Пока нет типов событий.</Text> : null}

              {eventTypes.map((eventType) => (
                <Card key={eventType.id} withBorder padding="lg" radius="md">
                  {editingId === eventType.id ? (
                    <form aria-label="Правка типа события" onSubmit={handleUpdate}>
                      <Stack gap="sm">
                        {editFailed ? (
                          <Alert color="red">Не удалось сохранить изменения</Alert>
                        ) : null}

                        <TextInput
                          label="Название"
                          value={editName}
                          onChange={(event) => setEditName(event.currentTarget.value)}
                          required
                        />
                        <TextInput
                          label="Описание"
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.currentTarget.value)}
                        />
                        <Group>
                          <Button type="submit" color="orange" loading={updating}>
                            Сохранить
                          </Button>
                          <Button type="button" variant="default" onClick={cancelEdit}>
                            Отмена
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  ) : (
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
                      <Group>
                        <Button variant="light" color="orange" onClick={() => startEdit(eventType)}>
                          Изменить
                        </Button>
                        <Button
                          variant="light"
                          color="red"
                          onClick={() => handleDelete(eventType.id)}
                        >
                          Удалить
                        </Button>
                      </Group>
                    </Stack>
                  )}
                </Card>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Container>
    </Box>
  )
}
