import { Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './layouts/AppLayout'
import { BookPage } from './pages/Book/BookPage'
import { EventsPage } from './pages/Events/EventsPage'
import { LandingPage } from './pages/Landing/LandingPage'

/**
 * Маршруты приложения: лендинг на `/`, заглушки разделов на `/book` и
 * `/events`; неизвестный путь ведёт на лендинг.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="book" element={<BookPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
