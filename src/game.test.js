import { describe, expect, it } from 'vitest'
import {
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
  pairRevealsBySequence,
  removePlayer,
  removeExpiredDisconnectedPlayer,
  reveal,
  resumeRound,
  setPlayerReady,
  startRound,
  submitCard,
} from './game.js'

function createReadyPlayers(count) {
  const room = createRoom('test-room')
  const players = Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    nickname: `Player ${index + 1}`,
    token: `token-${index + 1}`,
  }))

  for (const player of players) {
    addPlayer(room, player)
    const roomPlayer = room.players.find((item) => item.id === player.id)
    roomPlayer.connected = true
    roomPlayer.disconnectedAt = null
    setPlayerReady(room, player.id, true)
  }
  return { room, players }
}

function submitForEveryone(room, players) {
  for (const player of players) {
    submitCard(
      room,
      player.id,
      `What if player ${player.id} could fly?`,
      `Player ${player.id} would open a bakery.`,
    )
  }
}

function completeTwoPlayerRound(room, players) {
  startRound(room)
  submitForEveryone(room, players)
  distributeCards(room, () => 0.4)
  reveal(room, players[0].id, 'question')
  reveal(room, players[1].id, 'answer')
  reveal(room, players[1].id, 'question')
  reveal(room, players[0].id, 'answer')
}

describe('room setup', () => {
  it('requires room names and nicknames between 4 and 39 characters after trimming', () => {
    expect(normalizeRoomName('  Room  ')).toBe('Room')
    expect(normalizeNickname('  Guest  ')).toBe('Guest')
    expect(normalizeRoomName('r'.repeat(39))).toBe('r'.repeat(39))
    expect(normalizeNickname('n'.repeat(39))).toBe('n'.repeat(39))
    expect(() => normalizeRoomName('abc')).toThrow('Room names must be between 4 and 39 characters.')
    expect(() => normalizeRoomName('r'.repeat(40))).toThrow('Room names must be between 4 and 39 characters.')
    expect(() => normalizeNickname('abc')).toThrow('Nicknames must be between 4 and 39 characters.')
    expect(() => normalizeNickname('n'.repeat(40))).toThrow('Nicknames must be between 4 and 39 characters.')
  })

  it('requires at least two connected ready players to start', () => {
    const room = createRoom('test-room')
    addPlayer(room, { id: 'one', nickname: 'Player One', token: 'token' })
    room.players[0].connected = true
    setPlayerReady(room, 'one', true)

    expect(everyoneReady(room)).toBe(false)
    expect(() => startRound(room)).toThrow('At least two connected players must all be ready.')
  })

  it('starts card collection after all players are ready', () => {
    const { room } = createReadyPlayers(2)

    expect(everyoneReady(room)).toBe(true)
    startRound(room)

    expect(room.phase).toBe('submitting')
    expect(room.roundNumber).toBe(1)
  })

  it('requires each question to begin with What if', () => {
    const { room, players } = createReadyPlayers(2)
    startRound(room)

    expect(() => submitCard(room, players[0].id, 'Why is the sky blue?', 'Because of clouds.'))
      .toThrow('Your question must begin with “What if”.')
  })
})

describe('card distribution and reveal sequence', () => {
  it('assigns every card to a different player without self-assignment', () => {
    const { room, players } = createReadyPlayers(4)
    startRound(room)
    submitForEveryone(room, players)
    expect(everyoneSubmitted(room)).toBe(true)

    distributeCards(room, () => 0.4)

    for (const player of players) {
      const card = room.cards.find((item) => item.id === room.assignments[player.id])
      expect(card.authorId).not.toBe(player.id)
    }
    expect(new Set(Object.values(room.assignments)).size).toBe(players.length)
  })

  it('keeps player identities stable while author names follow their randomly assigned cards', () => {
    const { room, players } = createReadyPlayers(3)
    const playerIdentities = room.players.map(({ id, nickname }) => ({ id, nickname }))
    startRound(room)
    submitForEveryone(room, players)
    distributeCards(room, () => 0.4)

    expect(room.reveals).toEqual([])
    for (const player of players) {
      const card = room.cards.find((item) => item.id === room.assignments[player.id])
      expect(card.authorNickname).toBe(players.find((author) => author.id === card.authorId).nickname)
    }

    const reader = players[0]
    const assignedCard = room.cards.find((card) => card.id === room.assignments[reader.id])
    reveal(room, reader.id, 'question')
    reveal(room, players[1].id, 'answer')
    reveal(room, players[1].id, 'question')

    expect(room.reveals[0]).toMatchObject({
      playerId: reader.id,
      nickname: reader.nickname,
      authorId: assignedCard.authorId,
      authorNickname: assignedCard.authorNickname,
    })
    expect(room.reveals[1].authorNickname).toBe(
      room.cards.find((card) => card.id === room.assignments[players[1].id]).authorNickname,
    )
    expect(room.reveals[2].authorId).toBe(room.reveals[1].authorId)
    expect(room.reveals[2].authorNickname).toBe(room.reveals[1].authorNickname)
    expect(room.players.map(({ id, nickname }) => ({ id, nickname }))).toEqual(playerIdentities)
  })

  it('follows question, next player answer and question, ending with the starter answer', () => {
    const { room, players } = createReadyPlayers(3)
    startRound(room)
    submitForEveryone(room, players)
    distributeCards(room, () => 0.4)

    reveal(room, players[0].id, 'question')
    reveal(room, players[1].id, 'answer')
    reveal(room, players[1].id, 'question')
    reveal(room, players[2].id, 'answer')
    reveal(room, players[2].id, 'question')
    reveal(room, players[0].id, 'answer')

    expect(room.reveals.map(({ playerId, type }) => [playerId, type])).toEqual([
      ['player-1', 'question'],
      ['player-2', 'answer'],
      ['player-2', 'question'],
      ['player-3', 'answer'],
      ['player-3', 'question'],
      ['player-1', 'answer'],
    ])
    expect(room.phase).toBe('completed')
  })

  it('pairs each question with the next answer in the completed reveal sequence', () => {
    const reveals = [
      { type: 'question', text: 'Question 1' },
      { type: 'answer', text: 'Answer 2' },
      { type: 'question', text: 'Question 2' },
      { type: 'answer', text: 'Answer 3' },
      { type: 'question', text: 'Question 3' },
      { type: 'answer', text: 'Answer 1' },
    ]

    expect(pairRevealsBySequence(reveals)).toEqual([
      { question: reveals[0], answer: reveals[1] },
      { question: reveals[2], answer: reveals[3] },
      { question: reveals[4], answer: reveals[5] },
    ])
  })

  it('keeps the final reveal visible until another round is selected, then archives the full round', () => {
    const { room, players } = createReadyPlayers(2)
    completeTwoPlayerRound(room, players)
    const finalAnswer = room.reveals.at(-1)

    expect(room.phase).toBe('completed')
    expect(finalAnswer.type).toBe('answer')
    expect(room.history).toEqual([])

    beginNextRound(room)

    expect(room.phase).toBe('lobby')
    expect(room.reveals).toEqual([])
    expect(room.history).toHaveLength(1)
    expect(room.history[0].roundNumber).toBe(1)
    expect(room.history[0].reveals.at(-1)).toEqual(finalAnswer)

    for (const player of players) setPlayerReady(room, player.id, true)
    startRound(room)
    expect(room.roundNumber).toBe(2)
    expect(room.history).toHaveLength(1)
  })

  it('ends a game into a reviewable lobby and closes a room without clearing its history', () => {
    const { room, players } = createReadyPlayers(2)
    completeTwoPlayerRound(room, players)
    const finalAnswer = room.reveals.at(-1)

    endGame(room)

    expect(room.phase).toBe('lobby')
    expect(room.gameEnded).toBe(true)
    expect(room.history).toHaveLength(1)
    expect(room.history[0].reveals.at(-1)).toEqual(finalAnswer)
    expect(() => closeRoom(room)).not.toThrow()
    expect(room.phase).toBe('closed')
    expect(room.history).toHaveLength(1)
  })

  it('does not allow closing a room before ending the game', () => {
    const { room } = createReadyPlayers(2)

    expect(() => closeRoom(room)).toThrow('End the game before closing the room.')
  })

  it('removes a leaver’s assigned card while keeping their submitted card in play for its recipient', () => {
    const { room, players } = createReadyPlayers(3)
    startRound(room)
    submitForEveryone(room, players)
    distributeCards(room, () => 0.4)
    const leavingPlayer = players[1]
    const theirSubmittedCard = room.cards.find((card) => card.authorId === leavingPlayer.id)
    const recipientId = Object.entries(room.assignments)
      .find(([, cardId]) => cardId === theirSubmittedCard.id)[0]

    removePlayer(room, leavingPlayer.id)

    expect(room.assignments[leavingPlayer.id]).toBeUndefined()
    expect(room.cards).toContainEqual(theirSubmittedCard)
    expect(room.assignments[recipientId]).toBe(theirSubmittedCard.id)
  })

  it('continues the reveal chain after a player leaves during a round', () => {
    const { room, players } = createReadyPlayers(3)
    startRound(room)
    submitForEveryone(room, players)
    distributeCards(room, () => 0.4)
    reveal(room, players[0].id, 'question')
    removePlayer(room, players[1].id)

    expect(room.nextReveal).toEqual({ playerId: players[2].id, type: 'answer' })
    reveal(room, players[2].id, 'answer')
    reveal(room, players[2].id, 'question')
    reveal(room, players[0].id, 'answer')

    expect(room.phase).toBe('completed')
  })

  it('pauses after a reconnect timeout and resumes after removal and readiness', () => {
    const { room, players } = createReadyPlayers(2)
    startRound(room)
    submitForEveryone(room, players)
    distributeCards(room, () => 0.4)
    reveal(room, players[0].id, 'question')
    room.players[1].connected = false
    room.players[1].disconnectedAt = 1000
    pauseRound(room, 31_000)

    removeExpiredDisconnectedPlayer(room, players[1].id, 31_000)
    setPlayerReady(room, players[0].id, true)
    resumeRound(room)

    expect(room.phase).toBe('revealing')
    expect(room.nextReveal).toEqual({ playerId: players[0].id, type: 'answer' })
  })

  it('rejects removal before the reconnect grace period ends', () => {
    const { room, players } = createReadyPlayers(2)
    room.players[1].connected = false
    room.players[1].disconnectedAt = 1000

    expect(() => removeExpiredDisconnectedPlayer(room, players[1].id, 30_999))
      .toThrow('Wait until the 30-second reconnect window has passed.')
  })
})
