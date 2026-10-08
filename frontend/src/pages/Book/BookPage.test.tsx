import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { BookPage } from './BookPage'

describe('BookPage', () => {
  it('показывает заголовок раздела и кнопку возврата', () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <BookPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Записаться' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/')
  })
})
