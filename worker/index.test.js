import { describe, expect, it } from 'vitest'
import worker, { Room, RoomDirectory } from './index.js'

class MemoryStorage {
  constructor() {
    this.values = new Map()
  }

  async get(key) {
    return this.values.get(key)
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value))
  }

  async delete(key) {
    this.values.delete(key)
  }

  async deleteAll() {
    this.values.clear()
  }

  async setAlarm() {}

  async deleteAlarm() {}
}

function createContext() {
  const storage = new MemoryStorage()
  return {
    storage,
    blockConcurrencyWhile: (operation) => operation(),
    getWebSockets: () => [],
  }
}

function createDirectoryBinding(directory) {
  return {
    idFromName: (name) => name,
    get: () => ({ fetch: (request, init) => directory.fetch(new Request(request, init)) }),
  }
}

describe('active room directory', () => {
  it('rejects private room codes shorter than five characters at the API boundary', async () => {
    const response = await worker.fetch(new Request('https://game.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPrivate: true, accessCode: 'four' }),
    }), {})

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Private room codes must be at least 5 characters.',
    })
  })

  it('lists only occupied open rooms and exposes only room access metadata', async () => {
    const ctx = createContext()
    const directory = new RoomDirectory(ctx)
    await directory.fetch(new Request('https://directory.internal/rooms', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId: '00000000-0000-0000-0000-000000000001',
        isPrivate: true,
        phase: 'lobby',
        playerCount: 2,
        createdAt: 1,
        accessCode: 'not-listed',
      }),
    }))
    await directory.fetch(new Request('https://directory.internal/rooms', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId: '00000000-0000-0000-0000-000000000002',
        isPrivate: false,
        phase: 'lobby',
        playerCount: 0,
        createdAt: 2,
      }),
    }))
    const response = await directory.fetch(new Request('https://directory.internal/rooms'))
    const { rooms } = await response.json()

    expect(rooms).toEqual([{
      roomId: '00000000-0000-0000-0000-000000000001',
      isPrivate: true,
      phase: 'lobby',
      playerCount: 2,
      createdAt: 1,
    }])
  })

  it('requires the private room code and does not expose private room state before joining', async () => {
    const directory = new RoomDirectory(createContext())
    const env = { ROOM_DIRECTORY: createDirectoryBinding(directory) }
    const room = new Room(createContext(), env)
    const roomId = '00000000-0000-0000-0000-000000000003'

    await room.fetch(new Request('https://room.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId, accessCode: 'private code' }),
    }))

    const publicState = await room.fetch(new Request('https://room.internal/state'))
    expect(await publicState.json()).toEqual({
      state: { id: roomId, phase: 'lobby', isPrivate: true, players: [] },
    })

    const wrongCode = await room.fetch(new Request('https://room.internal/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'join', nickname: 'Guest', accessCode: 'incorrect' }),
    }))
    expect(wrongCode.status).toBe(403)

    const accepted = await room.fetch(new Request('https://room.internal/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'join', nickname: 'Guest', accessCode: 'private code' }),
    }))
    expect(accepted.status).toBe(201)
    const { state } = await accepted.json()
    expect(state.players).toHaveLength(1)
    expect(state).not.toHaveProperty('accessCode')
    expect(state.isPrivate).toBe(true)

    const listing = await directory.fetch(new Request('https://directory.internal/rooms'))
    const { rooms } = await listing.json()
    expect(rooms).toMatchObject([{
      roomId,
      isPrivate: true,
      playerCount: 1,
      phase: 'lobby',
    }])
    expect(JSON.stringify(rooms)).not.toContain('private code')
  })

  it('keeps public room joins available without an access code', async () => {
    const directory = new RoomDirectory(createContext())
    const room = new Room(createContext(), {
      ROOM_DIRECTORY: createDirectoryBinding(directory),
    })

    await room.fetch(new Request('https://room.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: '00000000-0000-0000-0000-000000000004' }),
    }))
    const response = await room.fetch(new Request('https://room.internal/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'join', nickname: 'Guest' }),
    }))

    expect(response.status).toBe(201)
    expect((await response.json()).state.isPrivate).toBe(false)
  })
})
