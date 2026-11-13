# Online What If? Game Interview

This document records the product decisions gathered before implementation. The detailed rules are maintained in [the canonical game-rules document](./what-if-game-rules.md).

## Rooms and players

- The game supports multiple independent rooms, each with its own QR join code/link.
- Room names are required, 4–39 characters after trimming, and unique case-insensitively among active rooms. Show the name in the active-room directory and room header, including for private rooms. Release the name when its room closes or expires.
- The landing page lists occupied, open rooms and shows a lock for private rooms. Closed and empty rooms are not listed. Players can join a listed room in the lobby or between rounds, and during card submission up until cards are shuffled. A room remains visible but does not accept joins after shuffling until the next between-round period.
- A room can be created as public or private. A private room has a user-defined access code of at least five characters, separate from its room ID and invitation link. The landing page shows private rooms as locked; joining one requires the correct code, which is validated by the server and never included in public room listings or state.
- A room can have one or more occupants, but a round requires at least two active players.
- Creating a room requires the room name and creator's nickname; the creator joins as the first player.
- Players join as guests using a nickname, not a login username; accounts are not required.
- Nicknames are unique within a room and 4–39 characters after trimming.
- Any active player may start a round once there are at least two active players. There is no Ready step; any active player may also start later rounds.
- New players may join between rounds or during card submission until cards are shuffled.
- After all active players have submitted, show a Shuffle cards action to all active players. Any active player may press it to shuffle and assign cards and start the reveal phase.
- Empty rooms expire. Players have 30 seconds to reconnect after losing connection.

## Cards and reveal sequence

- Every player submits one card containing both a question and an answer. Questions must begin with “What if…”.
- Questions and answers are limited to 500 characters each.
- Submitted content is hidden from other players until it is revealed.
- Once every active player has submitted, wait for any active player to press Shuffle cards. Then shuffle and assign cards so no player receives their own card; do not accept new players after this action.
- The player's nickname is attached to their submitted card. Keep card author details hidden from the room until the card's first field is revealed.
- One player starts by revealing the Question on their assigned card.
- The next player reveals the Answer on their own assigned card, then reveals the Question on that same card.
- Continue in room order. Each next player reveals their Answer and then their Question.
- The starting player's Answer is revealed last, closing the chain. The round completes after each active player has revealed an Answer.
- The comic pairing is between one player's Question and the next player's Answer, even though each submitted card contains both fields.
- Label every revealed Question and Answer with the author name attached to that card. The player revealing a field remains the same room player; random distribution changes only which card they read, never the player identity or browser session.
- During card submission, show one **Your card** tab for card entry and its submission status. After automatic distribution, show **Your card** and **Progress** tabs, defaulting to **Your card**.
- In the reveal phase, the card tab shows only the player's currently actionable field from their assigned card, with its reveal action; otherwise it shows the latest public reveal and turn status. Preserve the existing reveal order.
- The Progress tab is always available during reveals and shows all public fields in order, how many fields have been revealed, and whose reveal is next. Never show unrevealed card content in this tab. Switching tabs does not change the turn or interrupt a reveal.
- Keep each view focused on the active Question/Answer task. Put room sharing (including its QR code) and the player list in a hamburger menu.
- After a round completes, show each Question with the next Answer in reveal order, including the final Question with the closing Answer. Preserve the completed round for review in room history.

## Rounds, departures, and reconnection

- The same room can play multiple rounds using fresh cards.
- Keep the final revealed answer and completed round visible until a player chooses what happens next.
- During an active round, the menu's Leave game action removes only that player according to the existing departure rules. After a round completes, label the equivalent action Return to lobby; it also removes only that player and returns them to the home screen. Do not add a per-player lobby or spectator state.
- Any active player may choose to start another round or end the game. Starting another round archives the completed round and returns everyone to the lobby; any active player can start the next round without a Ready step.
- Ending the game requires confirmation and returns everyone to the lobby. Keep every completed round available there for review, and leave the room open so players may review or play again later.
- From the lobby after ending the game, any active player may confirm that the room should be closed. Once closed, deny player access and new joins, but retain the room data in the Durable Object store; closing a room is not a request to erase its stored data.
- If a player disconnects, allow 30 seconds to reconnect. If they do not return, pause the active round.
- Any active player may remove a disconnected player. Once all remaining active players are connected, any active player may resume without a Ready step.
- If a player explicitly leaves during a round, remove the card assigned to that player from the round. Keep their submitted card in play if another player received it.
- When a room becomes empty, expire it.

## Hosting and project setup

- Use Cloudflare services available on the Free plan where possible.
- Cloudflare Durable Objects may be used for authoritative room state and realtime coordination.
- Include setup and deployment instructions; call out service limits or any requirement that could incur charges.
- The user is willing to configure the Cloudflare account and deployment as guided by the documentation.
