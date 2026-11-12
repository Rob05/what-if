import { describe, expect, it } from 'vitest'
import { getRevealCardField } from '../src/reveal-view.js'

const room = {
  phase: 'revealing',
  myCard: {
    question: 'What if the stars were made of candy?',
    answer: 'Then the moon would ask for a bite.',
  },
  nextReveal: null,
  reveals: [],
}

describe('reveal card view', () => {
  it('lets a player preview only the field due on their turn', () => {
    expect(getRevealCardField({
      ...room,
      nextReveal: { playerId: 'player-1', type: 'answer' },
      reveals: [{ type: 'question', text: 'A public question' }],
    }, 'player-1')).toEqual({
      type: 'answer',
      text: 'Then the moon would ask for a bite.',
    })
  })

  it('keeps the assigned card hidden while another player is revealing', () => {
    expect(getRevealCardField({
      ...room,
      nextReveal: { playerId: 'player-2', type: 'question' },
      reveals: [{ type: 'question', text: 'A public question' }],
    }, 'player-1')).toBeNull()
  })

  it('allows any player to choose the first question', () => {
    expect(getRevealCardField(room, 'player-1')).toEqual({
      type: 'question',
      text: 'What if the stars were made of candy?',
    })
  })

  it('does not expose the dealt card outside the reveal phase', () => {
    expect(getRevealCardField({ ...room, phase: 'submitting' }, 'player-1')).toBeNull()
  })
})
