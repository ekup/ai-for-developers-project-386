// Тонкая обёртка над сгенерированным SDK — единственный шов фронтенда для работы с API.
// Тесты страниц мокают этот модуль, а не сеть.
import { client } from './generated/client.gen'

// Запросы идут на `/api/...` относительно текущего origin: в dev их проксирует
// Vite, а в продакшене раздаёт тот же бэкенд. Абсолютный origin нужен, чтобы
// same-origin запросы работали и в браузере, и в тестовом jsdom.
client.setConfig({ baseUrl: window.location.origin })

export {
  bookingsCreate,
  bookingsUpcoming,
  eventTypesCreate,
  eventTypesList,
  eventTypesRemove,
  eventTypesSlots,
  eventTypesUpdate,
} from './generated'

export type {
  ApiErrorBody,
  Booking,
  CreateBookingRequest,
  CreateEventTypeRequest,
  EventType,
  SlotList,
  UpdateEventTypeRequest,
} from './generated'
