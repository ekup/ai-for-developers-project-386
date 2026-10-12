import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bookingsUpcoming } from '../../api/client'
import { formatSlotDateLabel, formatSlotTime } from '../Book/dates'
import { EventsPage } from './EventsPage'

vi.mock('../../api/client', () => ({
  bookingsUpcoming: vi.fn(),
}))

const shortType = {
  id: 1,
  name: 'Короткий звонок',
  description: 'Быстрый вопрос',
  durationMinutes: 15,
}

const first = {
  id: 1,
  eventType: shortType,
  startsAt: '2026-10-13T09:00:00+03:00',
  guestName: 'Анна',
  guestEmail: 'anna@example.com',
  comment: 'Позвоните заранее',
}

const second = {
  id: 2,
  eventType: { id: 2, name: 'Звонок', description: 'Обсуждение', durationMinutes: 30 },
  startsAt: '2026-10-13T11:15:00+03:00',
  guestName: 'Борис',
  guestEmail: 'boris@example.com',
  comment: '',
}

function renderEventsPage() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('EventsPage', () => {
  afterEach(() => {
    vi.mocked(bookingsUpcoming).mockReset()
  })

  it('показывает предстоящие встречи по порядку: время, тип, данные гостя и комментарий', async () => {
    vi.mocked(bookingsUpcoming).mockResolvedValue({ data: [first, second], error: undefined })

    renderEventsPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Предстоящие события' }),
    ).toBeInTheDocument()

    // Встречи идут в порядке, полученном от сервера.
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Короткий звонок', 'Звонок'])

    expect(
      screen.getByText(`${formatSlotDateLabel(first.startsAt)}, ${formatSlotTime(first.startsAt)}`),
    ).toBeInTheDocument()
    expect(screen.getByText('15 минут')).toBeInTheDocument()
    expect(screen.getByText('Анна')).toBeInTheDocument()
    expect(screen.getByText('anna@example.com')).toBeInTheDocument()
    expect(screen.getByText('Позвоните заранее')).toBeInTheDocument()

    expect(
      screen.getByText(
        `${formatSlotDateLabel(second.startsAt)}, ${formatSlotTime(second.startsAt)}`,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('30 минут')).toBeInTheDocument()
    expect(screen.getByText('Борис')).toBeInTheDocument()
    expect(screen.getByText('boris@example.com')).toBeInTheDocument()
  })

  it('сообщает, когда предстоящих встреч нет', async () => {
    vi.mocked(bookingsUpcoming).mockResolvedValue({ data: [], error: undefined })

    renderEventsPage()

    expect(await screen.findByText('Пока нет предстоящих встреч.')).toBeInTheDocument()
  })

  it('сообщает, если встречи не загрузились', async () => {
    vi.mocked(bookingsUpcoming).mockResolvedValue({
      data: undefined,
      error: { error: 'Внутренняя ошибка' },
    })

    renderEventsPage()

    expect(await screen.findByText('Не удалось загрузить встречи')).toBeInTheDocument()
  })
})
