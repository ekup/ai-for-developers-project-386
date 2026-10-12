import { Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './layouts/AppLayout'
import { AdminPage } from './pages/Admin/AdminPage'
import { BookPage } from './pages/Book/BookPage'
import { EventTypePage } from './pages/Book/EventTypePage'
import { EventsPage } from './pages/Events/EventsPage'
import { LandingPage } from './pages/Landing/LandingPage'

/**
 * Маршруты приложения: лендинг на `/`, список типов событий на `/book`,
 * страница типа события на `/book/:id`, предстоящие встречи владельца на
 * `/events`, управление типами событий на `/admin`; неизвестный путь ведёт на
 * лендинг.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="book" element={<BookPage />} />
        <Route path="book/:id" element={<EventTypePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
