import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bookingsCreate, bookingsWindow, eventTypesList, eventTypesSlots } from '../../api/client'
import { formatDateLabel, formatSlotDateLabel } from './dates'
import { EventTypePage } from './EventTypePage'

vi.mock('../../api/client', () => ({
  bookingsCreate: vi.fn(),
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

const slot = `${today}T09:00:00+03:00`
const createdBooking = {
  id: 7,
  eventType: aType,
  startsAt: slot,
  guestName: 'Анна',
  guestEmail: 'anna@example.com',
  comment: 'Позвоните заранее',
}

// mockBookingPage настраивает загрузку страницы: тип события, окно и один слот.
function mockBookingPage() {
  vi.mocked(eventTypesList).mockResolvedValue({ data: [aType], error: undefined })
  vi.mocked(bookingsWindow).mockResolvedValue({ data: serverWindow, error: undefined })
  vi.mocked(eventTypesSlots).mockResolvedValue({
    data: { date: today, slots: [slot] },
    error: undefined,
  })
}

// selectSlotAndFillForm выбирает слот и заполняет форму гостя.
function selectSlotAndFillForm(comment?: string) {
  fireEvent.click(screen.getByRole('button', { name: '09:00' }))
  fireEvent.change(screen.getByLabelText(/^Имя/), { target: { value: 'Анна' } })
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'anna@example.com' } })
  if (comment) {
    fireEvent.change(screen.getByLabelText(/^Комментарий/), { target: { value: comment } })
  }
}

describe('EventTypePage', () => {
  afterEach(() => {
    vi.mocked(bookingsCreate).mockReset()
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
        slots: [`${today}T09:00:00+03:00`, `${today}T09:30:00+03:00`],
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
    expect(screen.getByRole('button', { name: '09:30' })).toBeInTheDocument()

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

  it('показывает форму после выбора слота и создаёт запись с введёнными данными', async () => {
    mockBookingPage()
    vi.mocked(bookingsCreate).mockResolvedValue({ data: createdBooking, error: undefined })

    renderEventTypePage()
    await screen.findByRole('button', { name: '09:00' })
    selectSlotAndFillForm('Позвоните заранее')
    fireEvent.click(screen.getByRole('button', { name: 'Записаться' }))

    expect(await screen.findByText('Запись создана')).toBeInTheDocument()
    expect(bookingsCreate).toHaveBeenCalledWith({
      body: {
        eventTypeId: 1,
        startsAt: slot,
        guestName: 'Анна',
        guestEmail: 'anna@example.com',
        comment: 'Позвоните заранее',
      },
    })
  })

  it('показывает подтверждение с деталями созданной записи', async () => {
    mockBookingPage()
    vi.mocked(bookingsCreate).mockResolvedValue({ data: createdBooking, error: undefined })

    renderEventTypePage()
    await screen.findByRole('button', { name: '09:00' })
    selectSlotAndFillForm('Позвоните заранее')
    fireEvent.click(screen.getByRole('button', { name: 'Записаться' }))

    expect(await screen.findByText('Запись создана')).toBeInTheDocument()

    const details = screen.getByRole('region', { name: 'Детали записи' })
    expect(within(details).getByText('Короткий звонок')).toBeInTheDocument()
    expect(within(details).getByText(`${formatSlotDateLabel(slot)}, 09:00`)).toBeInTheDocument()
    expect(within(details).getByText('15 минут')).toBeInTheDocument()
    expect(within(details).getByText('Анна')).toBeInTheDocument()
    expect(within(details).getByText('anna@example.com')).toBeInTheDocument()
    expect(within(details).getByText('Позвоните заранее')).toBeInTheDocument()
  })

  it('сообщает о занятости слота и обновляет список свободных', async () => {
    mockBookingPage()
    vi.mocked(bookingsCreate).mockResolvedValue({
      data: undefined,
      error: { error: 'слот уже занят' },
      response: new Response(null, { status: 409 }),
    })

    renderEventTypePage()
    await screen.findByRole('button', { name: '09:00' })
    selectSlotAndFillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Записаться' }))

    expect(await screen.findByText('Это время уже занято')).toBeInTheDocument()
    expect(vi.mocked(eventTypesSlots).mock.calls.length).toBeGreaterThan(1)
  })
})
