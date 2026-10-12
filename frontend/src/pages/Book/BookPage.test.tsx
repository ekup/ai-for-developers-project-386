import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { eventTypesList } from '../../api/client'
import { BookPage } from './BookPage'

vi.mock('../../api/client', () => ({
  eventTypesList: vi.fn(),
}))

function renderBookPage() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <BookPage />
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('BookPage', () => {
  afterEach(() => {
    vi.mocked(eventTypesList).mockReset()
  })

  it('показывает список типов событий с названием, описанием и длительностью', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({
      data: [
        { id: 1, name: 'Короткий звонок', description: 'Быстрый вопрос', durationMinutes: 15 },
        { id: 2, name: 'Звонок', description: 'Обсуждение задачи', durationMinutes: 30 },
      ],
      error: undefined,
    })

    renderBookPage()

    expect(await screen.findByText('Короткий звонок')).toBeInTheDocument()
    expect(screen.getByText('Быстрый вопрос')).toBeInTheDocument()
    expect(screen.getByText('15 минут')).toBeInTheDocument()

    expect(screen.getByText('Звонок')).toBeInTheDocument()
    expect(screen.getByText('Обсуждение задачи')).toBeInTheDocument()
    expect(screen.getByText('30 минут')).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 1, name: 'Записаться' })).toBeInTheDocument()
  })

  it('показывает сообщение об ошибке, если список не загрузился', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({
      data: undefined,
      error: { error: 'Внутренняя ошибка' },
    })

    renderBookPage()

    expect(await screen.findByText('Не удалось загрузить типы событий')).toBeInTheDocument()
  })

  it('не падает, если вместо списка пришёл не массив', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({
      data: '<!doctype html><html></html>' as unknown as [],
      error: undefined,
    })

    renderBookPage()

    expect(await screen.findByText('Не удалось загрузить типы событий')).toBeInTheDocument()
  })
})
