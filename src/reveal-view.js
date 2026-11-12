export function getRevealCardField(room, playerId) {
  if (room.phase !== 'revealing' || !room.myCard) {
    return null
  }

  const fieldType = room.nextReveal?.playerId === playerId
    ? room.nextReveal.type
    : !room.nextReveal && room.reveals.length === 0
      ? 'question'
      : null

  return fieldType
    ? { type: fieldType, text: room.myCard[fieldType] }
    : null
}
