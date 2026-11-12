export const MIN_PLAYERS = 2
export const MAX_FIELD_LENGTH = 500
export const MIN_NAME_LENGTH = 4
export const MAX_NAME_LENGTH = 39
export const RECONNECT_GRACE_MS = 30_000

export function normalizeRoomName(value) {
  const roomName = typeof value === 'string' ? value.trim() : ''
  if (!roomName) {
    throw new Error('Enter a room name.')
  }
  if ([...roomName].length < MIN_NAME_LENGTH || [...roomName].length > MAX_NAME_LENGTH) {
    throw new Error(`Room names must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters.`)
  }
  return roomName
}

export function normalizeNickname(value) {
  const nickname = typeof value === 'string' ? value.trim() : ''
  if (!nickname) {
    throw new Error('Enter a nickname to join.')
  }
  if ([...nickname].length < MIN_NAME_LENGTH || [...nickname].length > MAX_NAME_LENGTH) {
    throw new Error(`Nicknames must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters.`)
  }
  return nickname
}

export function pairRevealsBySequence(reveals) {
  return reveals.flatMap((reveal, index) => {
    if (reveal.type !== 'question') {
      return []
    }

    const answer = reveals.slice(index + 1).find((item) => item.type === 'answer')
    return answer ? [{ question: reveal, answer }] : []
  })
}

export function createRoom(roomId, now = Date.now(), roomName = null) {
  return {
    id: roomId,
    roomName,
    createdAt: now,
    lastActivityAt: now,
    phase: 'lobby',
    roundNumber: 0,
    history: [],
    gameEnded: false,
    players: [],
    cards: [],
    assignments: {},
    revealOrder: [],
    starterId: null,
    nextReveal: null,
    reveals: [],
    answeredPlayerIds: [],
    questionedPlayerIds: [],
    pausedAt: null,
  }
}

export function addPlayer(room, { id, nickname, token, now = Date.now() }) {
  if (!['lobby', 'completed'].includes(room.phase)) {
    throw new Error('You can only join between rounds.')
  }

  const cleanNickname = normalizeNickname(nickname)
  if (activePlayers(room).some(
    (player) => player.nickname.toLocaleLowerCase() === cleanNickname.toLocaleLowerCase(),
  )) {
    throw new Error('That nickname is already in this room.')
  }

  room.players.push({
    id,
    nickname: cleanNickname,
    token,
    ready: false,
    connected: false,
    connectionId: null,
    disconnectedAt: now,
    removed: false,
  })
  room.lastActivityAt = now
}

export function activePlayers(room) {
  return room.players.filter((player) => !player.removed)
}

export function setPlayerReady(room, playerId, ready) {
  const player = requireActivePlayer(room, playerId)
  if (!['lobby', 'paused'].includes(room.phase)) {
    throw new Error('Readiness can only be changed between rounds or while paused.')
  }
  player.ready = Boolean(ready)
}

export function everyoneReady(room) {
  const players = activePlayers(room)
  return players.length >= MIN_PLAYERS
    && players.every((player) => player.ready && player.connected)
}

export function startRound(room) {
  if (room.phase !== 'lobby') {
    throw new Error('A round is already in progress.')
  }
  if (!everyoneReady(room)) {
    throw new Error('At least two connected players must all be ready.')
  }

  room.phase = 'submitting'
  room.gameEnded = false
  room.roundNumber += 1
  room.cards = []
  room.assignments = {}
  room.revealOrder = []
  room.starterId = null
  room.nextReveal = null
  room.reveals = []
  room.answeredPlayerIds = []
  room.questionedPlayerIds = []
  room.pausedAt = null
  for (const player of activePlayers(room)) {
    player.ready = false
  }
}

export function beginNextRound(room) {
  if (room.phase !== 'completed') {
    throw new Error('The round is not complete.')
  }
  archiveCompletedRound(room)
  resetRound(room)
  room.phase = 'lobby'
  room.gameEnded = false
}

export function endGame(room) {
  if (room.phase !== 'completed') {
    throw new Error('The round is not complete.')
  }
  archiveCompletedRound(room)
  resetRound(room)
  room.phase = 'lobby'
  room.gameEnded = true
}

export function closeRoom(room) {
  if (room.phase !== 'lobby' || !room.gameEnded) {
    throw new Error('End the game before closing the room.')
  }
  room.phase = 'closed'
}

export function submitCard(room, playerId, question, answer) {
  const player = requireActivePlayer(room, playerId)
  if (room.phase !== 'submitting') {
    throw new Error('Cards are not being collected right now.')
  }
  if (room.cards.some((card) => card.authorId === playerId)) {
    throw new Error('You have already submitted a card this round.')
  }

  const cleanQuestion = question.trim()
  const cleanAnswer = answer.trim()
  if (!/^what if(?:\s|[.!?…]|$)/i.test(cleanQuestion)) {
    throw new Error('Your question must begin with “What if”.')
  }
  if (!cleanAnswer) {
    throw new Error('Enter an answer before submitting.')
  }
  if (cleanQuestion.length > MAX_FIELD_LENGTH || cleanAnswer.length > MAX_FIELD_LENGTH) {
    throw new Error(`Questions and answers must be ${MAX_FIELD_LENGTH} characters or fewer.`)
  }

  room.cards.push({
    id: crypto.randomUUID(),
    authorId: player.id,
    authorNickname: player.nickname,
    question: cleanQuestion,
    answer: cleanAnswer,
  })
}

export function everyoneSubmitted(room) {
  const submittedIds = new Set(room.cards.map((card) => card.authorId))
  const players = activePlayers(room)
  return players.length >= MIN_PLAYERS && players.every((player) => submittedIds.has(player.id))
}

export function distributeCards(room, random = Math.random) {
  if (room.phase !== 'submitting' || !everyoneSubmitted(room)) {
    throw new Error('Wait until every active player has submitted a card.')
  }

  const cardsByAuthor = new Map(room.cards.map((card) => [card.authorId, card]))
  const recipients = activePlayers(room)
  const shuffled = [...recipients]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * index)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  room.assignments = Object.fromEntries(
    recipients.map((recipient, index) => {
      const card = cardsByAuthor.get(shuffled[index].id)
      return [recipient.id, card.id]
    }),
  )
  room.phase = 'revealing'
}

export function reveal(room, playerId, type) {
  const player = requireActivePlayer(room, playerId)
  if (room.phase !== 'revealing') {
    throw new Error('There is nothing to reveal right now.')
  }
  if (!['question', 'answer'].includes(type)) {
    throw new Error('Choose a valid card field to reveal.')
  }
  if (room.nextReveal) {
    if (room.nextReveal.playerId !== playerId || room.nextReveal.type !== type) {
      throw new Error(`It is not your turn to reveal the ${type}.`)
    }
  } else if (type !== 'question') {
    throw new Error('The round must begin with a question.')
  }

  const cardId = room.assignments[playerId]
  const card = room.cards.find((item) => item.id === cardId)
  if (!card) {
    throw new Error('Your assigned card is no longer in play.')
  }
  const author = room.players.find((item) => item.id === card.authorId)
  if (!author) {
    throw new Error('The author of your assigned card could not be found.')
  }
  if (!room.starterId) {
    room.starterId = playerId
    room.revealOrder = activePlayers(room).map((activePlayer) => activePlayer.id)
  }

  room.reveals.push({
    playerId,
    nickname: player.nickname,
    authorId: card.authorId,
    authorNickname: card.authorNickname ?? author.nickname,
    type,
    text: card[type],
  })
  if (type === 'question') {
    addOnce(room.questionedPlayerIds, playerId)
    const nextPlayerId = findNextUnanswered(room, playerId)
    if (nextPlayerId) {
      room.nextReveal = { playerId: nextPlayerId, type: 'answer' }
    } else {
      completeRound(room)
    }
  } else {
    addOnce(room.answeredPlayerIds, playerId)
    if (allActivePlayersAnswered(room)) {
      room.phase = 'completed'
      room.nextReveal = null
      room.starterId = null
      for (const activePlayer of activePlayers(room)) {
        activePlayer.ready = false
      }
    } else if (!room.questionedPlayerIds.includes(playerId)) {
      room.nextReveal = { playerId, type: 'question' }
    } else {
      const nextPlayerId = findNextUnanswered(room, playerId)
      if (nextPlayerId) {
        room.nextReveal = { playerId: nextPlayerId, type: 'answer' }
      } else {
        completeRound(room)
      }
    }
  }
}

export function pauseRound(room, now = Date.now()) {
  if (room.phase !== 'revealing') {
    return false
  }
  room.phase = 'paused'
  room.pausedAt = now
  for (const player of activePlayers(room)) {
    player.ready = false
  }
  return true
}

export function resumeRound(room) {
  if (room.phase !== 'paused') {
    throw new Error('The round is not paused.')
  }
  if (!everyoneReadyWhilePaused(room)) {
    throw new Error('All remaining connected players must be ready to resume.')
  }
  room.phase = 'revealing'
  room.pausedAt = null
  for (const player of activePlayers(room)) {
    player.ready = false
  }
}

export function removePlayer(room, playerId) {
  const player = requireActivePlayer(room, playerId)
  player.removed = true
  player.ready = false
  player.connected = false
  player.connectionId = null
  player.disconnectedAt = null

  if (room.phase === 'submitting') {
    room.cards = room.cards.filter((card) => card.authorId !== playerId)
    if (activePlayers(room).length < MIN_PLAYERS) {
      room.phase = 'lobby'
      room.roundNumber = Math.max(0, room.roundNumber - 1)
      room.cards = []
      for (const activePlayer of activePlayers(room)) {
        activePlayer.ready = false
      }
    }
  }
  if (['revealing', 'paused'].includes(room.phase) && room.assignments[playerId]) {
    delete room.assignments[playerId]
    if (room.nextReveal?.playerId === playerId) {
      if (!room.reveals.length && room.questionedPlayerIds.length === 0) {
        room.starterId = null
        room.revealOrder = activePlayers(room).map((activePlayer) => activePlayer.id)
        room.nextReveal = null
      } else {
        const nextPlayerId = findNextUnanswered(room, playerId)
        room.nextReveal = nextPlayerId
          ? { playerId: nextPlayerId, type: 'answer' }
          : null
        if (!nextPlayerId) {
          completeRound(room)
        }
      }
    }
  }
}

export function removeExpiredDisconnectedPlayer(room, playerId, now = Date.now()) {
  const player = requireActivePlayer(room, playerId)
  if (player.connected || !player.disconnectedAt) {
    throw new Error('That player is not disconnected.')
  }
  if (now - player.disconnectedAt < RECONNECT_GRACE_MS) {
    throw new Error('Wait until the 30-second reconnect window has passed.')
  }
  removePlayer(room, playerId)
}

export function roomIsExpired(room) {
  return activePlayers(room).length === 0
}

export function everyoneReadyWhilePaused(room) {
  const players = activePlayers(room)
  return players.length > 0 && players.every((player) => player.ready && player.connected)
}

export function requireActivePlayer(room, playerId) {
  const player = room.players.find((item) => item.id === playerId && !item.removed)
  if (!player) {
    throw new Error('Your player session is no longer in this room.')
  }
  return player
}

function findNextUnanswered(room, afterPlayerId) {
  const answered = new Set(room.answeredPlayerIds)
  const activeIds = new Set(activePlayers(room).map((player) => player.id))
  const order = room.revealOrder.filter((playerId) => activeIds.has(playerId))
  if (!order.length) {
    return null
  }

  const startIndex = Math.max(0, order.indexOf(afterPlayerId))
  for (let offset = 1; offset <= order.length; offset += 1) {
    const playerId = order[(startIndex + offset) % order.length]
    if (!answered.has(playerId)) {
      return playerId
    }
  }
  return null
}

function allActivePlayersAnswered(room) {
  const answered = new Set(room.answeredPlayerIds)
  return activePlayers(room).every((player) => answered.has(player.id))
}

function addOnce(list, value) {
  if (!list.includes(value)) {
    list.push(value)
  }
}

function completeRound(room) {
  room.phase = 'completed'
  room.nextReveal = null
  room.starterId = null
  room.pausedAt = null
  for (const player of activePlayers(room)) {
    player.ready = false
  }
}

function archiveCompletedRound(room) {
  room.history ??= []
  if (!room.reveals.length || room.history.some((round) => round.roundNumber === room.roundNumber)) {
    return
  }
  room.history.push({
    roundNumber: room.roundNumber,
    reveals: room.reveals.map((item) => ({ ...item })),
    completedAt: Date.now(),
  })
}

function resetRound(room) {
  room.cards = []
  room.assignments = {}
  room.revealOrder = []
  room.starterId = null
  room.nextReveal = null
  room.reveals = []
  room.answeredPlayerIds = []
  room.questionedPlayerIds = []
  room.pausedAt = null
  for (const player of activePlayers(room)) {
    player.ready = false
  }
}
