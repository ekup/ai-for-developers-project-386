import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('показывает все пункты блока «Что доступно»', () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(screen.getByText('Фиксированные слоты по 30 минут с 09:00 до 18:00')).toBeInTheDocument()
    expect(screen.getByText('Проверка конфликтов: один слот — одна запись')).toBeInTheDocument()
    expect(screen.getByText('Предстоящие записи в отдельном разделе')).toBeInTheDocument()
  })
})
