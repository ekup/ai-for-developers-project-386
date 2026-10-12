import { afterEach, describe, expect, it, vi } from 'vitest'

import { eventTypesList } from './client'

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
})
