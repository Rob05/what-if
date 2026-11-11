# Online What If? Game Interview

This document records the product decisions gathered before implementation. The detailed rules are maintained in [the canonical game-rules document](./what-if-game-rules.md).

## Rooms and players

- The game supports multiple independent rooms, each with its own QR join code/link.
- A room can have one or more occupants, but a round requires at least two active players.
- Players join as guests using a nickname; accounts are not required.
- Nicknames are unique within a room and limited to 24 characters.
- Every player must mark Ready before a round can start. Once everyone is ready, any active player may start it.
- New players may join between rounds.
- Any active player may distribute cards once all active players have submitted.
- Empty rooms expire. Players have 30 seconds to reconnect after losing connection.

## Cards and reveal sequence

- Every player submits one card containing both a question and an answer. Questions must begin with “What if…”.
- Questions and answers are limited to 500 characters each.
- Submitted content is hidden from other players until it is revealed.
- Once every active player has submitted, the cards are shuffled and assigned so no player receives their own card.
- The player's nickname is attached to their submitted card. Keep card author details hidden from the room until the card's first field is revealed.
- One player starts by revealing the Question on their assigned card.
- The next player reveals the Answer on their own assigned card, then reveals the Question on that same card.
- Continue in room order. Each next player reveals their Answer and then their Question.
- The starting player's Answer is revealed last, closing the chain. The round completes after each active player has revealed an Answer.
- The comic pairing is between one player's Question and the next player's Answer, even though each submitted card contains both fields.
- Label every revealed Question and Answer with the author name attached to that card. The player revealing a field remains the same room player; random distribution changes only which card they read, never the player identity or browser session.

## Rounds, departures, and reconnection

- The same room can play multiple rounds using fresh cards.
- Keep the final revealed answer and completed round visible until a player chooses what happens next.
- Any active player may choose to start another round or end the game. Starting another round archives the completed round and returns everyone to the lobby; all active players must be ready before any player can start the next round.
- Ending the game requires confirmation and returns everyone to the lobby. Keep every completed round available there for review, and leave the room open so players may review or play again later.
- From the lobby after ending the game, any active player may confirm that the room should be closed. Once closed, deny player access and new joins, but retain the room data in the Durable Object store; closing a room is not a request to erase its stored data.
- If a player disconnects, allow 30 seconds to reconnect. If they do not return, pause the active round.
- Any active player may remove a disconnected player. The remaining players must all mark Ready before resuming.
- If a player explicitly leaves during a round, remove the card assigned to that player from the round. Keep their submitted card in play if another player received it.
- When a room becomes empty, expire it.

## Hosting and project setup

- Use Cloudflare services available on the Free plan where possible.
- Cloudflare Durable Objects may be used for authoritative room state and realtime coordination.
- Include setup and deployment instructions; call out service limits or any requirement that could incur charges.
- The user is willing to configure the Cloudflare account and deployment as guided by the documentation.
