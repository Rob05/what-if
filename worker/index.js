import {
  RECONNECT_GRACE_MS,
  activePlayers,
  addPlayer,
  beginNextRound,
  closeRoom,
  createRoom,
  distributeCards,
  endGame,
  everyoneReady,
  everyoneSubmitted,
  normalizeNickname,
  normalizeRoomName,
  pauseRound,
  removeExpiredDisconnectedPlayer,
  removePlayer,
  resumeRound,
  reveal,
  roomIsExpired,
  setPlayerReady,
  startRound,
  submitCard,
} from '../src/game.js'

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/rooms' && request.method === 'GET') {
        const directory = env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName('active-rooms'))
        return directory.fetch('https://directory.internal/rooms')
      }

      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        const hasJsonBody = request.headers.get('content-type')?.includes('application/json')
        const body = hasJsonBody ? await readJson(request) : {}
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new HttpError('Request body must be a JSON object.', 400)
        }
        const roomName = normalizeRequestName(body.roomName, normalizeRoomName)
        const nickname = normalizeRequestName(body.nickname, normalizeNickname)
        if (body.isPrivate !== undefined && typeof body.isPrivate !== 'boolean') {
          throw new HttpError('Private room selection must be true or false.', 400)
        }
        const isPrivate = body.isPrivate === true
        const accessCode = isPrivate ? normalizeAccessCode(body.accessCode) : null
        if (isPrivate && (!accessCode || [...accessCode].length < 5)) {
          throw new HttpError('Private room codes must be at least 5 characters.', 400)
        }

        const roomId = crypto.randomUUID()
        const room = env.ROOMS.get(env.ROOMS.idFromName(roomId))
        const response = await room.fetch('https://room.internal/init', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ roomId, roomName, nickname, accessCode }),
        })
        if (!response.ok) {
          return response
        }
        const initializedRoom = await response.json()
        const directory = env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName('active-rooms'))
        const registration = await directory.fetch('https://directory.internal/rooms', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            roomId,
            roomName,
            isPrivate,
            phase: 'lobby',
            playerCount: 1,
            createdAt: Date.now(),
          }),
        })
        if (!registration.ok) {
          const discardResponse = await room.fetch('https://room.internal/discard', { method: 'POST' })
          if (!discardResponse.ok) {
            console.error('Room creation failed, and its unregistered room state could not be removed.')
          }
          if (registration.status === 409) {
            return json({ error: 'A room with that name already exists.' }, 409)
          }
          throw new HttpError(`Could not register the room name (${registration.status}).`, 503)
        }
        return json({ roomId, player: initializedRoom.player }, 201)
      }

      const match = url.pathname.match(/^\/api\/rooms\/([0-9a-f-]{36})(\/connect)?$/i)
      if (match) {
        const [, roomId, connectPath] = match
        if (connectPath && request.method !== 'GET') {
          return json({ error: 'WebSocket connections must use GET.' }, 405)
        }
        if (!connectPath && !['GET', 'POST'].includes(request.method)) {
          return json({ error: 'Room routes support GET and POST.' }, 405)
        }
        const room = env.ROOMS.get(env.ROOMS.idFromName(roomId))
        const target = new URL(
          connectPath ? '/connect' : request.method === 'GET' ? '/state' : '/action',
          'https://room.internal',
        )
        target.search = url.search
        return room.fetch(new Request(target, request))
      }

      if (url.pathname.startsWith('/api/')) {
        return json({ error: 'API route not found.' }, 404)
      }

      return env.ASSETS.fetch(request)
    } catch (error) {
      console.error('Request failed', error)
      return json(
        { error: error instanceof Error ? error.message : 'Unexpected server error.' },
        error instanceof HttpError ? error.status : 500,
      )
    }
  },
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.room = null
    this.queue = Promise.resolve()
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get('room') ?? null
    })
  }

  async fetch(request) {
    await this.ready
    const url = new URL(request.url)

    if (url.pathname === '/init' && request.method === 'POST') {
      return this.initialize(request)
    }
    if (url.pathname === '/discard' && request.method === 'POST') {
      return this.discard()
    }
    if (url.pathname === '/connect' && request.method === 'GET') {
      return this.connect(request)
    }
    if (url.pathname === '/state' && request.method === 'GET') {
      return this.getState(request)
    }
    if (url.pathname === '/action' && request.method === 'POST') {
      return this.handleAction(request)
    }
    return json({ error: 'Room route not found.' }, 404)
  }

  async syncDirectory() {
    if (!this.room) {
      return
    }
    if (['closed', 'expired'].includes(this.room.phase) || activePlayers(this.room).length === 0) {
      await this.removeFromDirectory(this.room.id)
      return
    }
    const directory = this.env.ROOM_DIRECTORY.get(this.env.ROOM_DIRECTORY.idFromName('active-rooms'))
    const response = await directory.fetch('https://directory.internal/rooms', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        roomId: this.room.id,
        roomName: roomNameFor(this.room),
        isPrivate: Boolean(this.room.accessCode),
        phase: this.room.phase,
        playerCount: activePlayers(this.room).length,
        createdAt: this.room.createdAt,
      }),
    })
    if (!response.ok) {
      throw new Error(`Could not update the active-room directory (${response.status}).`)
    }
  }

  async removeFromDirectory(roomId) {
    const directory = this.env.ROOM_DIRECTORY.get(this.env.ROOM_DIRECTORY.idFromName('active-rooms'))
    const response = await directory.fetch(`https://directory.internal/rooms/${roomId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(`Could not remove the room from the active-room directory (${response.status}).`)
    }
  }

  async initialize(request) {
    if (this.room) {
      return json({ error: 'Room already exists.' }, 409)
    }
    const {
      roomId,
      roomName: suppliedRoomName,
      nickname: suppliedNickname,
      accessCode = null,
    } = await readJson(request)
    const roomName = normalizeRequestName(suppliedRoomName, normalizeRoomName)
    const nickname = normalizeRequestName(suppliedNickname, normalizeNickname)
    this.room = createRoom(roomId, Date.now(), roomName)
    this.room.accessCode = accessCode
    const player = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
    }
    addPlayer(this.room, { ...player, nickname })
    await this.ctx.storage.put('room', this.room)
    await this.scheduleAlarm()
    return json({
      roomId,
      player: { playerId: player.id, token: player.token },
    }, 201)
  }

  async discard() {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.room = null
    return json({ ok: true })
  }

  async connect(request) {
    if (!this.room || ['expired', 'closed'].includes(this.room.phase)) {
      return json({ error: this.room?.phase === 'closed' ? 'This room has been closed.' : 'This room has expired.' }, 410)
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'A WebSocket connection is required.' }, 426)
    }

    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')
    const token = url.searchParams.get('token')
    const player = this.findPlayer(this.room, playerId, token)
    if (!player) {
      return json({ error: 'Player session is not valid for this room.' }, 401)
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const connectionId = crypto.randomUUID()
    this.ctx.acceptWebSocket(server, [playerId])
    server.serializeAttachment({ playerId, connectionId })

    await this.mutate((room) => {
      const currentPlayer = this.findPlayer(room, playerId, token)
      currentPlayer.connected = true
      currentPlayer.connectionId = connectionId
      currentPlayer.disconnectedAt = null
    })
    await this.scheduleAlarm()
    return new Response(null, { status: 101, webSocket: client })
  }

  async getState(request) {
    await this.ready
    if (!this.room || ['expired', 'closed'].includes(this.room.phase)) {
      return json({ error: this.room?.phase === 'closed' ? 'This room has been closed.' : 'This room has expired.' }, 410)
    }

    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')
    const token = url.searchParams.get('token')
    let player = null
    if (playerId || token) {
      player = this.findPlayer(this.room, playerId, token)
      if (!player) {
        return json({ error: 'Player session is not valid for this room.' }, 401)
      }
    }
    if (this.room.phase === 'submitting' && everyoneSubmitted(this.room)) {
      await this.mutate((room) => {
        if (room.phase === 'submitting' && everyoneSubmitted(room)) {
          distributeCards(room)
        }
      })
    }
    return json({ state: this.view(this.room, player?.id) })
  }

  async handleAction(request) {
    if (!this.room || ['expired', 'closed'].includes(this.room.phase)) {
      return json({ error: this.room?.phase === 'closed' ? 'This room has been closed.' : 'This room has expired.' }, 410)
    }

    try {
      const body = await readJson(request)
      const { value: result, directoryWarning } = await this.mutate((room) => {
        if (body.action === 'join') {
          if (room.accessCode && normalizeAccessCode(body.accessCode) !== room.accessCode) {
            throw new HttpError('The private room code is incorrect.', 403)
          }
          const player = {
            id: crypto.randomUUID(),
            token: crypto.randomUUID(),
          }
          addPlayer(room, {
            ...player,
            nickname: body.nickname ?? '',
          })
          return { player }
        }

        const actor = this.findPlayer(room, body.playerId, body.token)
        if (!actor) {
          throw new HttpError('Player session is not valid for this room.', 401)
        }

        switch (body.action) {
          case 'ready':
            setPlayerReady(room, actor.id, body.ready)
            break
          case 'start-round':
            startRound(room)
            break
          case 'begin-next-round':
            beginNextRound(room)
            break
          case 'end-game':
            endGame(room)
            break
          case 'delete-room':
            closeRoom(room)
            break
          case 'submit':
            submitCard(room, actor.id, body.question ?? '', body.answer ?? '')
            break
          case 'reveal':
            reveal(room, actor.id, body.type)
            break
          case 'remove-player': {
            const target = room.players.find((player) => player.id === body.targetPlayerId)
            if (!target || target.removed) {
              throw new HttpError('That player is no longer in this room.', 404)
            }
            if (target.connected) {
              throw new HttpError('Only a disconnected player can be removed this way.', 409)
            }
            removeExpiredDisconnectedPlayer(room, target.id)
            break
          }
          case 'resume':
            resumeRound(room)
            break
          case 'leave':
            removePlayer(room, actor.id)
            break
          default:
            throw new HttpError('Unknown room action.', 400)
        }

        return null
      })

      if (body.action === 'join') {
        await this.scheduleAlarm()
        return json({
          player: {
            playerId: result.player.id,
            token: result.player.token,
          },
          state: this.view(this.room, result.player.id),
          ...(directoryWarning ? { warning: directoryWarning } : {}),
        }, 201)
      }
      if (body.action === 'delete-room') {
        for (const socket of this.ctx.getWebSockets()) {
          socket.close(1000, 'Room closed.')
        }
      }
      if (roomIsExpired(this.room)) {
        const expiryWarning = await this.expireRoom()
        return json({
          expired: true,
          ...((directoryWarning || expiryWarning)
            ? { warning: directoryWarning ?? expiryWarning }
            : {}),
        })
      }
      await this.scheduleAlarm()
      return json({
        state: this.view(this.room, body.playerId),
        ...(directoryWarning ? { warning: directoryWarning } : {}),
      })
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Unable to update the room.' },
        error instanceof HttpError ? error.status : 400,
      )
    }
  }

  async webSocketMessage(socket, message) {
    if (message !== 'ping') {
      socket.close(1008, 'Unsupported message.')
      return
    }
    socket.send('pong')
  }

  async webSocketClose(socket) {
    await this.markDisconnected(socket)
  }

  async webSocketError(socket) {
    await this.markDisconnected(socket)
  }

  async alarm() {
    await this.ready
    if (!this.room) {
      return
    }
    if (this.room.phase === 'expired') {
      await this.expireRoom()
      return
    }
    if (this.room.phase === 'closed') {
      await this.ctx.storage.deleteAlarm()
      return
    }

    await this.mutate((room) => {
      const players = activePlayers(room)
      const now = Date.now()
      const noneConnected = players.length > 0 && players.every((player) => !player.connected)
      if (noneConnected && players.every(
        (player) => player.disconnectedAt && now - player.disconnectedAt >= RECONNECT_GRACE_MS,
      )) {
        room.phase = 'expired'
        return
      }

      const timedOut = players.some(
        (player) => !player.connected
          && player.disconnectedAt
          && now - player.disconnectedAt >= RECONNECT_GRACE_MS,
      )
      if (timedOut && room.phase === 'revealing') {
        pauseRound(room, now)
      }
    })

    if (this.room?.phase === 'expired' || !this.room) {
      await this.expireRoom()
      return
    }
    await this.scheduleAlarm()
  }

  async markDisconnected(socket) {
    const attachment = socket.deserializeAttachment()
    if (!attachment?.playerId) {
      return
    }

    try {
      await this.mutate((room) => {
        const player = room.players.find((item) => item.id === attachment.playerId)
        if (!player || player.removed || player.connectionId !== attachment.connectionId) {
          return
        }
        player.connected = false
        player.connectionId = null
        player.disconnectedAt = Date.now()
      })
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 410)) {
        throw error
      }
    }
    await this.scheduleAlarm()
  }

  async mutate(operation) {
    return this.enqueue(async () => {
      if (!this.room || ['expired', 'closed'].includes(this.room.phase)) {
        throw new HttpError(this.room?.phase === 'closed' ? 'This room has been closed.' : 'This room has expired.', 410)
      }

      const nextRoom = structuredClone(this.room)
      const result = operation(nextRoom)
      if (nextRoom.phase === 'submitting' && everyoneSubmitted(nextRoom)) {
        distributeCards(nextRoom)
      }
      nextRoom.lastActivityAt = Date.now()
      await this.ctx.storage.put('room', nextRoom)
      this.room = nextRoom
      let directoryWarning
      try {
        await this.syncDirectory()
      } catch (error) {
        console.error('Room state changed, but the active-room directory could not be updated.', error)
        directoryWarning = error instanceof Error
          ? error.message
          : 'The active-room directory could not be updated.'
      }
      await this.broadcast()
      return { value: result, directoryWarning }
    })
  }

  async enqueue(operation) {
    const task = this.queue.then(operation)
    this.queue = task.then(() => undefined, () => undefined)
    return task
  }

  async broadcast() {
    if (!this.room) {
      return
    }
    const sockets = this.ctx.getWebSockets()
    for (const socket of sockets) {
      const attachment = socket.deserializeAttachment()
      const playerId = attachment?.playerId
      if (!playerId) {
        continue
      }
      try {
        socket.send(JSON.stringify({
          type: 'state',
          state: this.view(this.room, playerId),
        }))
      } catch (error) {
        console.warn('Unable to broadcast room state to a player.', error)
        socket.close(1011, 'Unable to receive room updates.')
      }
    }
  }

  view(room, playerId) {
    if (room.accessCode && !playerId) {
      return {
        id: room.id,
        roomName: roomNameFor(room),
        phase: room.phase,
        isPrivate: true,
        players: [],
      }
    }

    const active = activePlayers(room)
    const assignedCardId = playerId ? room.assignments[playerId] : null
    const assignedCard = assignedCardId
      ? room.cards.find((card) => card.id === assignedCardId)
      : null
    const player = playerId ? room.players.find((item) => item.id === playerId) : null
    const submittedIds = new Set(room.cards.map((card) => card.authorId))

    return {
      id: room.id,
      roomName: roomNameFor(room),
      isPrivate: Boolean(room.accessCode),
      phase: room.phase,
      roundNumber: room.roundNumber,
      history: room.history ?? [],
      gameEnded: room.gameEnded ?? false,
      players: active.map((item) => ({
        id: item.id,
        nickname: item.nickname,
        ready: item.ready,
        connected: item.connected,
        disconnectedAt: item.disconnectedAt,
        submitted: room.phase === 'submitting' && submittedIds.has(item.id),
      })),
      allReady: everyoneReady(room),
      allSubmitted: room.phase === 'submitting' && everyoneSubmitted(room),
      nextReveal: room.nextReveal,
      starterId: room.starterId,
      reveals: room.reveals,
      pausedAt: room.pausedAt,
      myPlayerId: player?.id ?? null,
      myCard: assignedCard ? {
        question: assignedCard.question,
        answer: assignedCard.answer,
      } : null,
      hasSubmitted: player ? room.phase === 'submitting' && submittedIds.has(player.id) : false,
    }
  }

  findPlayer(room, playerId, token) {
    if (!playerId || !token) {
      return null
    }
    return room.players.find(
      (player) => player.id === playerId && player.token === token && !player.removed,
    ) ?? null
  }

  async scheduleAlarm() {
    if (!this.room || ['expired', 'closed'].includes(this.room.phase)) {
      await this.ctx.storage.deleteAlarm()
      return
    }
    const active = activePlayers(this.room)
    const disconnected = active.filter((player) => !player.connected && player.disconnectedAt)
    if (!disconnected.length) {
      await this.ctx.storage.deleteAlarm()
      return
    }
    const allDisconnected = active.length > 0 && active.every((player) => !player.connected)
    if (allDisconnected) {
      const roomExpiry = Math.max(
        ...disconnected.map((player) => player.disconnectedAt + RECONNECT_GRACE_MS),
      )
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, roomExpiry))
      return
    }
    if (this.room.phase !== 'revealing') {
      await this.ctx.storage.deleteAlarm()
      return
    }

    const pendingDeadlines = disconnected
      .map((player) => player.disconnectedAt + RECONNECT_GRACE_MS)
      .filter((deadline) => deadline > Date.now())
    if (!pendingDeadlines.length) {
      await this.ctx.storage.deleteAlarm()
      return
    }
    const deadline = Math.min(...pendingDeadlines)
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, deadline))
  }

  async expireRoom() {
    const roomId = this.room?.id
    let directoryWarning
    if (roomId) {
      try {
        await this.removeFromDirectory(roomId)
      } catch (error) {
        console.error('Room expired, but its active-room listing could not be removed.', error)
        directoryWarning = error instanceof Error
          ? error.message
          : 'The active-room listing could not be removed.'
      }
    }
    for (const socket of this.ctx.getWebSockets()) {
      socket.close(1000, 'Room expired.')
    }
    await this.ctx.storage.deleteAll()
    this.room = null
    return directoryWarning
  }
}

export class RoomDirectory {
  constructor(ctx) {
    this.ctx = ctx
    this.rooms = {}
    this.queue = Promise.resolve()
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.rooms = await ctx.storage.get('rooms') ?? {}
    })
  }

  async fetch(request) {
    await this.ready
    const url = new URL(request.url)
    if (url.pathname === '/rooms' && request.method === 'GET') {
      return this.list()
    }
    if (url.pathname === '/rooms' && request.method === 'POST') {
      return this.register(request)
    }
    if (url.pathname === '/rooms' && request.method === 'PUT') {
      return this.update(request)
    }
    const match = url.pathname.match(/^\/rooms\/([0-9a-f-]{36})$/i)
    if (match && request.method === 'DELETE') {
      return this.remove(match[1])
    }
    return json({ error: 'Room directory route not found.' }, 404)
  }

  async list() {
    return this.enqueue(async () => {
      const rooms = Object.values(this.rooms)
        .filter((room) => room.playerCount > 0 && !['closed', 'expired'].includes(room.phase))
        .sort((left, right) => right.createdAt - left.createdAt)
      return json({ rooms })
    })
  }

  async register(request) {
    const room = await readJson(request)
    let roomName
    try {
      roomName = normalizeRoomName(room.roomName)
    } catch (error) {
      return json({ error: error.message }, 400)
    }
    if (!room.roomId || !room.phase || !Number.isInteger(room.playerCount) || room.playerCount < 1) {
      return json({ error: 'Room listing data is invalid.' }, 400)
    }

    return this.enqueue(async () => {
      const duplicateName = Object.values(this.rooms).some(
        (existing) => existing.roomId !== room.roomId
          && roomNameFor({ id: existing.roomId, roomName: existing.roomName }).toLocaleLowerCase()
            === roomName.toLocaleLowerCase(),
      )
      if (duplicateName) {
        return json({ error: 'A room with that name already exists.' }, 409)
      }

      this.rooms[room.roomId] = {
        roomId: room.roomId,
        roomName,
        isPrivate: Boolean(room.isPrivate),
        phase: room.phase,
        playerCount: room.playerCount,
        createdAt: room.createdAt,
      }
      await this.ctx.storage.put('rooms', this.rooms)
      return json({ ok: true })
    })
  }

  async update(request) {
    const room = await readJson(request)
    let roomName
    try {
      roomName = normalizeRoomName(room.roomName)
    } catch (error) {
      return json({ error: error.message }, 400)
    }
    if (!room.roomId || !room.phase || !Number.isInteger(room.playerCount)) {
      return json({ error: 'Room listing data is invalid.' }, 400)
    }

    return this.enqueue(async () => {
      const existing = this.rooms[room.roomId]
      if (existing && roomNameFor({ id: existing.roomId, roomName: existing.roomName }).toLocaleLowerCase()
        !== roomName.toLocaleLowerCase()) {
        return json({ error: 'Room names cannot be changed after creation.' }, 409)
      }
      const duplicateName = Object.values(this.rooms).some(
        (listedRoom) => listedRoom.roomId !== room.roomId
          && roomNameFor({ id: listedRoom.roomId, roomName: listedRoom.roomName }).toLocaleLowerCase()
            === roomName.toLocaleLowerCase(),
      )
      if (duplicateName) {
        return json({ error: 'A room with that name already exists.' }, 409)
      }
      this.rooms[room.roomId] = {
        roomId: room.roomId,
        roomName,
        isPrivate: Boolean(room.isPrivate),
        phase: room.phase,
        playerCount: room.playerCount,
        createdAt: room.createdAt,
      }
      await this.ctx.storage.put('rooms', this.rooms)
      return json({ ok: true })
    })
  }

  async remove(roomId) {
    await this.enqueue(async () => {
      delete this.rooms[roomId]
      await this.ctx.storage.put('rooms', this.rooms)
    })
    return json({ ok: true })
  }

  async enqueue(operation) {
    const task = this.queue.then(operation)
    this.queue = task.then(() => undefined, () => undefined)
    return task
  }
}

function normalizeAccessCode(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRequestName(value, normalize) {
  try {
    return normalize(value)
  } catch (error) {
    throw new HttpError(error.message, 400)
  }
}

function roomNameFor(room) {
  const roomId = room.id ?? room.roomId
  return room.roomName ?? `Room ${roomId.slice(0, 8).toUpperCase()}`
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw new HttpError('Request body must be valid JSON.', 400)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  })
}

class HttpError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}
