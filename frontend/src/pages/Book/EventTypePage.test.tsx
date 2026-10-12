import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bookingsWindow, eventTypesList, eventTypesSlots } from '../../api/client'
import { formatDateLabel } from './dates'
import { EventTypePage } from './EventTypePage'

vi.mock('../../api/client', () => ({
  bookingsWindow: vi.fn(),
  eventTypesList: vi.fn(),
  eventTypesSlots: vi.fn(),
}))

function renderEventTypePage(path = '/book/1') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/book/:id" element={<EventTypePage />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  )
}

// Окно записи приходит с сервера — в тестах фиксируем его, чтобы не зависеть
// от часов машины.
const serverWindow = { start: '2026-10-12', end: '2026-10-25' }
const today = serverWindow.start
const tomorrow = '2026-10-13'

const aType = { id: 1, name: 'Короткий звонок', description: 'Быстрый вопрос', durationMinutes: 15 }

describe('EventTypePage', () => {
  afterEach(() => {
    vi.mocked(eventTypesList).mockReset()
    vi.mocked(eventTypesSlots).mockReset()
    vi.mocked(bookingsWindow).mockReset()
  })

  it('показывает тип события, календарь окна записи и свободные слоты даты', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [aType], error: undefined })
    vi.mocked(bookingsWindow).mockResolvedValue({ data: serverWindow, error: undefined })
    vi.mocked(eventTypesSlots).mockResolvedValue({
      data: {
        date: today,
        slots: [`${today}T09:00:00+03:00`, `${today}T09:15:00+03:00`],
      },
      error: undefined,
    })

    renderEventTypePage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Короткий звонок' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Быстрый вопрос')).toBeInTheDocument()
    expect(screen.getByText('15 минут')).toBeInTheDocument()

    // Календарь показывает ровно дни серверного окна: без вчерашнего и без
    // дня за окном.
    const calendar = screen.getByRole('group', { name: 'Календарь' })
    expect(within(calendar).getAllByRole('button')).toHaveLength(14)
    expect(
      within(calendar).queryByRole('button', { name: formatDateLabel('2026-10-11') }),
    ).not.toBeInTheDocument()
    expect(
      within(calendar).queryByRole('button', { name: formatDateLabel('2026-10-26') }),
    ).not.toBeInTheDocument()

    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '09:15' })).toBeInTheDocument()

    expect(eventTypesSlots).toHaveBeenCalledWith({ path: { id: 1 }, query: { date: today } })
  })

  it('перезапрашивает слоты при выборе другой даты', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [aType], error: undefined })
    vi.mocked(bookingsWindow).mockResolvedValue({ data: serverWindow, error: undefined })
    vi.mocked(eventTypesSlots)
      .mockResolvedValueOnce({
        data: { date: today, slots: [`${today}T09:00:00+03:00`] },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: { date: tomorrow, slots: [] },
        error: undefined,
      })

    renderEventTypePage()
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: formatDateLabel(tomorrow) }))

    expect(await screen.findByText('Нет свободных слотов на эту дату.')).toBeInTheDocument()
    expect(eventTypesSlots).toHaveBeenLastCalledWith({ path: { id: 1 }, query: { date: tomorrow } })
  })

  it('сообщает, если на выбранную дату нет свободных слотов', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({
      data: [{ ...aType, name: 'Звонок', durationMinutes: 30 }],
      error: undefined,
    })
    vi.mocked(bookingsWindow).mockResolvedValue({ data: serverWindow, error: undefined })
    vi.mocked(eventTypesSlots).mockResolvedValue({
      data: { date: today, slots: [] },
      error: undefined,
    })

    renderEventTypePage()

    expect(await screen.findByText('Нет свободных слотов на эту дату.')).toBeInTheDocument()
  })

  it('сообщает, если тип события не найден', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [], error: undefined })
    vi.mocked(bookingsWindow).mockResolvedValue({ data: serverWindow, error: undefined })

    renderEventTypePage('/book/999')

    expect(await screen.findByText('Тип события не найден')).toBeInTheDocument()
  })

  it('сообщает, если тип события не загрузился', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({
      data: undefined,
      error: { error: 'Внутренняя ошибка' },
    })
    vi.mocked(bookingsWindow).mockResolvedValue({ data: serverWindow, error: undefined })

    renderEventTypePage()

    expect(await screen.findByText('Не удалось загрузить тип события')).toBeInTheDocument()
  })

  it('сообщает, если календарь не загрузился', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [aType], error: undefined })
    vi.mocked(bookingsWindow).mockResolvedValue({
      data: undefined,
      error: { error: 'Внутренняя ошибка' },
    })

    renderEventTypePage()

    expect(await screen.findByText('Не удалось загрузить календарь')).toBeInTheDocument()
  })

  it('не падает, если окно записи пришло не в формате JSON', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [aType], error: undefined })
    vi.mocked(bookingsWindow).mockResolvedValue({
      data: '<!doctype html><html></html>' as unknown as { start: string; end: string },
      error: undefined,
    })

    renderEventTypePage()

    expect(await screen.findByText('Не удалось загрузить календарь')).toBeInTheDocument()
  })
})
