import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AppLayout } from './AppLayout'

describe('AppLayout', () => {
  it('показывает бренд и ссылки навигации', () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<div>содержимое</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(screen.getByText('Запись на звонок')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute('href', '/book')
    expect(screen.getByRole('link', { name: 'Предстоящие события' })).toHaveAttribute(
      'href',
      '/events',
    )
  })
})
