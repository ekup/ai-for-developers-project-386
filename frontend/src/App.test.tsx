import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { App } from './App'

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

  it('ведёт на лендинг с неизвестного пути', () => {
    renderApp(['/unknown'])

    expect(screen.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeInTheDocument()
  })
})
