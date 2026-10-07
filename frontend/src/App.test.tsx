import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('показывает приветствие на лендинге', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeInTheDocument()
    expect(screen.getByText(/Привет!/)).toBeInTheDocument()
  })
})
