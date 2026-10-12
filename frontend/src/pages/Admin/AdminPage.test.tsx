import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  eventTypesCreate,
  eventTypesList,
  eventTypesRemove,
  eventTypesUpdate,
} from '../../api/client'
import { AdminPage } from './AdminPage'

vi.mock('../../api/client', () => ({
  eventTypesCreate: vi.fn(),
  eventTypesList: vi.fn(),
  eventTypesRemove: vi.fn(),
  eventTypesUpdate: vi.fn(),
}))

const shortType = {
  id: 1,
  name: 'Короткий звонок',
  description: 'Быстрый вопрос',
  durationMinutes: 15,
}
const longType = { id: 2, name: 'Звонок', description: 'Обсуждение задачи', durationMinutes: 30 }

function renderAdminPage() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('AdminPage', () => {
  afterEach(() => {
    vi.mocked(eventTypesList).mockReset()
    vi.mocked(eventTypesCreate).mockReset()
    vi.mocked(eventTypesUpdate).mockReset()
    vi.mocked(eventTypesRemove).mockReset()
  })

  it('показывает существующие типы событий', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [shortType, longType], error: undefined })

    renderAdminPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Управление типами событий' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Короткий звонок')).toBeInTheDocument()
    expect(screen.getByText('Быстрый вопрос')).toBeInTheDocument()
    expect(screen.getByText('15 минут')).toBeInTheDocument()
    expect(screen.getByText('Звонок')).toBeInTheDocument()
    expect(screen.getByText('30 минут')).toBeInTheDocument()
  })

  it('создаёт тип события с введёнными данными и показывает его в списке', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [], error: undefined })
    vi.mocked(eventTypesCreate).mockResolvedValue({
      data: { id: 3, name: 'Консультация', description: 'Разбор задачи', durationMinutes: 45 },
      error: undefined,
    })

    renderAdminPage()
    const form = within(await screen.findByRole('form', { name: 'Новый тип события' }))

    fireEvent.change(form.getByLabelText(/^Название/), { target: { value: 'Консультация' } })
    fireEvent.change(form.getByLabelText(/^Описание/), { target: { value: 'Разбор задачи' } })
    fireEvent.change(form.getByLabelText(/^Длительность/), { target: { value: '45' } })
    fireEvent.click(form.getByRole('button', { name: 'Создать' }))

    await waitFor(() =>
      expect(eventTypesCreate).toHaveBeenCalledWith({
        body: { name: 'Консультация', description: 'Разбор задачи', durationMinutes: 45 },
      }),
    )
    expect(await screen.findByText('Консультация')).toBeInTheDocument()
  })

  it('сообщает об ошибке, если создать тип не удалось', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [], error: undefined })
    vi.mocked(eventTypesCreate).mockResolvedValue({
      data: undefined,
      error: { error: 'название обязательно' },
    })

    renderAdminPage()
    const form = within(await screen.findByRole('form', { name: 'Новый тип события' }))

    fireEvent.change(form.getByLabelText(/^Название/), { target: { value: 'Консультация' } })
    fireEvent.change(form.getByLabelText(/^Длительность/), { target: { value: '45' } })
    fireEvent.click(form.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByText('Не удалось создать тип события')).toBeInTheDocument()
  })

  it('правит название и описание типа события', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [shortType], error: undefined })
    vi.mocked(eventTypesUpdate).mockResolvedValue({
      data: { ...shortType, name: 'Обновлённый звонок', description: 'Новое описание' },
      error: undefined,
    })

    renderAdminPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }))
    const form = within(screen.getByRole('form', { name: 'Правка типа события' }))
    fireEvent.change(form.getByLabelText(/^Название/), { target: { value: 'Обновлённый звонок' } })
    fireEvent.change(form.getByLabelText(/^Описание/), { target: { value: 'Новое описание' } })
    fireEvent.click(form.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(eventTypesUpdate).toHaveBeenCalledWith({
        path: { id: 1 },
        body: { name: 'Обновлённый звонок', description: 'Новое описание' },
      }),
    )
    expect(await screen.findByText('Обновлённый звонок')).toBeInTheDocument()
    expect(screen.getByText('Новое описание')).toBeInTheDocument()
  })

  it('удаляет тип события из списка', async () => {
    vi.mocked(eventTypesList).mockResolvedValue({ data: [shortType, longType], error: undefined })
    vi.mocked(eventTypesRemove).mockResolvedValue({ data: undefined, error: undefined })

    renderAdminPage()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Удалить' }))[0])

    await waitFor(() => expect(eventTypesRemove).toHaveBeenCalledWith({ path: { id: 1 } }))
    await waitFor(() => expect(screen.queryByText('Короткий звонок')).not.toBeInTheDocument())
    expect(screen.getByText('Звонок')).toBeInTheDocument()
  })
})
