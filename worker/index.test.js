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

function createRoomBinding(directory) {
  const rooms = new Map()
  return {
    idFromName: (name) => name,
    get: (roomId) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Room(createContext(), {
          ROOM_DIRECTORY: createDirectoryBinding(directory),
        }))
      }
      const room = rooms.get(roomId)
      return { fetch: (request, init) => room.fetch(new Request(request, init)) }
    },
  }
}

describe('active room directory', () => {
  it('requires valid room and creator names when creating a room', async () => {
    const shortRoomName = await worker.fetch(new Request('https://game.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomName: 'abc', nickname: 'Creator' }),
    }), {})
    const shortNickname = await worker.fetch(new Request('https://game.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomName: 'Party Room', nickname: 'abc' }),
    }), {})

    expect(shortRoomName.status).toBe(400)
    expect(await shortRoomName.json()).toEqual({
      error: 'Room names must be between 4 and 39 characters.',
    })
    expect(shortNickname.status).toBe(400)
    expect(await shortNickname.json()).toEqual({
      error: 'Nicknames must be between 4 and 39 characters.',
    })
  })

  it('rejects private room codes shorter than five characters at the API boundary', async () => {
    const response = await worker.fetch(new Request('https://game.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomName: 'Private Table',
        nickname: 'Private Host',
        isPrivate: true,
        accessCode: 'four',
      }),
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
        roomName: 'Private Table',
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
        roomName: 'Empty Room',
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
      roomName: 'Private Table',
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
      body: JSON.stringify({
        roomId,
        roomName: 'Private Table',
        nickname: 'Private Host',
        accessCode: 'private code',
      }),
    }))

    const publicState = await room.fetch(new Request('https://room.internal/state'))
    expect(await publicState.json()).toEqual({
      state: { id: roomId, roomName: 'Private Table', phase: 'lobby', isPrivate: true, players: [] },
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
    expect(state.players).toHaveLength(2)
    expect(state).not.toHaveProperty('accessCode')
    expect(state.isPrivate).toBe(true)

    const listing = await directory.fetch(new Request('https://directory.internal/rooms'))
    const { rooms } = await listing.json()
    expect(rooms).toMatchObject([{
      roomId,
      roomName: 'Private Table',
      isPrivate: true,
      playerCount: 2,
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
      body: JSON.stringify({
        roomId: '00000000-0000-0000-0000-000000000004',
        roomName: 'Public Table',
        nickname: 'Public Host',
      }),
    }))
    const response = await room.fetch(new Request('https://room.internal/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'join', nickname: 'Guest' }),
    }))

    expect(response.status).toBe(201)
    expect((await response.json()).state.isPrivate).toBe(false)
  })

  it('creates a named room and automatically joins its creator', async () => {
    const directory = new RoomDirectory(createContext())
    const env = {
      ROOM_DIRECTORY: createDirectoryBinding(directory),
      ROOMS: createRoomBinding(directory),
    }
    const response = await worker.fetch(new Request('https://game.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomName: '  Family Night  ',
        nickname: '  Host Player  ',
      }),
    }), env)
    const payload = await response.json()
    const listing = await directory.fetch(new Request('https://directory.internal/rooms'))

    expect(response.status).toBe(201)
    expect(payload.player).toMatchObject({
      playerId: expect.any(String),
      token: expect.any(String),
    })
    expect((await listing.json()).rooms).toMatchObject([{
      roomId: payload.roomId,
      roomName: 'Family Night',
      playerCount: 1,
    }])

    const roomState = await worker.fetch(new Request(
      `https://game.test/api/rooms/${payload.roomId}?playerId=${payload.player.playerId}&token=${payload.player.token}`,
    ), env)
    expect((await roomState.json()).state).toMatchObject({
      roomName: 'Family Night',
      players: [{ nickname: 'Host Player' }],
    })

    const invalidJoin = await worker.fetch(new Request(`https://game.test/api/rooms/${payload.roomId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'join', nickname: 'abc' }),
    }), env)
    expect(invalidJoin.status).toBe(400)
    expect(await invalidJoin.json()).toEqual({
      error: 'Nicknames must be between 4 and 39 characters.',
    })
  })

  it('atomically rejects duplicate active room names ignoring case and surrounding spaces', async () => {
    const directory = new RoomDirectory(createContext())
    const env = {
      ROOM_DIRECTORY: createDirectoryBinding(directory),
      ROOMS: createRoomBinding(directory),
    }
    const create = (roomName) => worker.fetch(new Request('https://game.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomName, nickname: 'Host Player' }),
    }), env)

    const responses = await Promise.all([
      create('Game Night'),
      create('  game night  '),
    ])
    const listing = await directory.fetch(new Request('https://directory.internal/rooms'))

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409])
    expect((await listing.json()).rooms).toHaveLength(1)
  })

  it('allows a room name to be reused after its active listing is removed', async () => {
    const directory = new RoomDirectory(createContext())
    const register = (roomId) => directory.fetch(new Request('https://directory.internal/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId,
        roomName: 'Game Night',
        phase: 'lobby',
        playerCount: 1,
        createdAt: 1,
      }),
    }))

    expect((await register('00000000-0000-0000-0000-000000000005')).status).toBe(200)
    await directory.fetch(new Request(
      'https://directory.internal/rooms/00000000-0000-0000-0000-000000000005',
      { method: 'DELETE' },
    ))
    expect((await register('00000000-0000-0000-0000-000000000006')).status).toBe(200)
  })

  it('expires a room whose creator never connects and releases its name', async () => {
    const directory = new RoomDirectory(createContext())
    const room = new Room(createContext(), {
      ROOM_DIRECTORY: createDirectoryBinding(directory),
    })
    const roomId = '00000000-0000-0000-0000-000000000007'
    const initialized = await room.fetch(new Request('https://room.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId,
        roomName: 'Creator Away',
        nickname: 'Host Player',
      }),
    }))
    const { player } = await initialized.json()
    await room.fetch(new Request('https://room.internal/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'ready',
        ready: true,
        playerId: player.playerId,
        token: player.token,
      }),
    }))
    room.room.players[0].disconnectedAt = Date.now() - 31_000

    await room.alarm()
    const listing = await directory.fetch(new Request('https://directory.internal/rooms'))
    const reusableName = await directory.fetch(new Request('https://directory.internal/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId: '00000000-0000-0000-0000-000000000008',
        roomName: 'Creator Away',
        phase: 'lobby',
        playerCount: 1,
        createdAt: 2,
      }),
    }))

    expect(await listing.json()).toEqual({ rooms: [] })
    expect(reusableName.status).toBe(200)
  })
})
