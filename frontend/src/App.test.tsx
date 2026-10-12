import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { eventTypesList, eventTypesSlots, bookingsWindow } from './api/client'
import { App } from './App'

// Страницы обращаются к API при монтировании — в тестах маршрутов мокаем
// модуль-клиент, чтобы не ходить в сеть.
vi.mock('./api/client', () => ({
  bookingsWindow: vi.fn(),
  eventTypesList: vi.fn(),
  eventTypesSlots: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(eventTypesList).mockReset()
  vi.mocked(eventTypesList).mockResolvedValue({ data: [], error: undefined })
  vi.mocked(eventTypesSlots).mockReset()
  vi.mocked(eventTypesSlots).mockResolvedValue({
    data: { date: '', slots: [] },
    error: undefined,
  })
  vi.mocked(bookingsWindow).mockReset()
  vi.mocked(bookingsWindow).mockResolvedValue({
    data: { start: '2026-10-12', end: '2026-10-25' },
    error: undefined,
  })
})

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('App', () => {
  it('показывает лендинг с заголовком и блоком «Что доступно»', () => {
    renderApp()

    expect(screen.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Что доступно' })).toBeInTheDocument()
  })

  it('переводит в раздел записи по кнопке «Записаться»', () => {
    renderApp()

    fireEvent.click(screen.getAllByRole('link', { name: 'Записаться' })[0])

    expect(screen.getByRole('heading', { level: 1, name: 'Записаться' })).toBeInTheDocument()
  })

  it('переводит в предстоящие события по ссылке навигации', () => {
    renderApp()

    fireEvent.click(screen.getByRole('link', { name: 'Предстоящие события' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Предстоящие события' }),
    ).toBeInTheDocument()
  })

  it('переходит со списка типов событий на страницу типа', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({
      data: [
        { id: 1, name: 'Короткий звонок', description: 'Быстрый вопрос', durationMinutes: 15 },
      ],
      error: undefined,
    })
    vi.mocked(eventTypesSlots).mockResolvedValue({
      data: { date: '2026-10-13', slots: ['2026-10-13T09:00:00+03:00'] },
      error: undefined,
    })

    renderApp(['/book'])

    fireEvent.click(await screen.findByRole('link', { name: 'Выбрать время' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Короткий звонок' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument()
  })

  it('ведёт на лендинг с неизвестного пути', () => {
    renderApp(['/unknown'])

    expect(screen.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeInTheDocument()
  })
})
