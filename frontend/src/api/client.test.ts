import { afterEach, describe, expect, it, vi } from 'vitest'

import { bookingsWindow, eventTypesList, eventTypesSlots } from './client'

describe('клиент API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('читает список типов событий через сгенерированный SDK', async () => {
    const payload = [
      { id: 1, name: 'Короткий звонок', description: 'Встреча на 15 минут', durationMinutes: 15 },
      { id: 2, name: 'Звонок', description: 'Встреча на 30 минут', durationMinutes: 30 },
    ]

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await eventTypesList()

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(payload)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('читает свободные слоты типа события на дату через сгенерированный SDK', async () => {
    const payload = {
      date: '2026-10-13',
      slots: ['2026-10-13T09:00:00+03:00', '2026-10-13T09:30:00+03:00'],
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await eventTypesSlots({ path: { id: 1 }, query: { date: '2026-10-13' } })

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(payload)

    const request = fetchMock.mock.calls[0][0] as Request
    expect(request.url).toContain('/api/event-types/1/slots')
    expect(request.url).toContain('date=2026-10-13')
  })

  it('читает окно записи через сгенерированный SDK', async () => {
    const payload = { start: '2026-10-12', end: '2026-10-25' }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await bookingsWindow()

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(payload)

    const request = fetchMock.mock.calls[0][0] as Request
    expect(request.url).toContain('/api/bookings/window')
  })
})
