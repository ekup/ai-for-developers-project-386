import '@mantine/core/styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { BrowserRouter } from 'react-router'

import { App } from './App'
import { theme } from './theme'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Не найден корневой элемент #root')
}

createRoot(container).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
