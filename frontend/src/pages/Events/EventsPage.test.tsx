import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { EventsPage } from './EventsPage'

describe('EventsPage', () => {
  it('показывает заголовок раздела и кнопку возврата', () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <EventsPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Предстоящие события' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/')
  })
})
