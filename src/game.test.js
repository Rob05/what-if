import { describe, expect, it } from 'vitest'
import {
  addPlayer,
  createRoom,
  distributeCards,
  everyoneReady,
  everyoneSubmitted,
  pauseRound,
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

describe('room setup', () => {
  it('requires at least two connected ready players to start', () => {
    const room = createRoom('test-room')
    addPlayer(room, { id: 'one', nickname: 'One', token: 'token' })
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
