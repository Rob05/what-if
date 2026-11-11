# What If? Game Rules

This document is the canonical reference for the party game mechanics in this project. Use the standard rules as the default for the online game. The variations below are optional and should not silently replace standard play.

## Game description

What If? is a pen-and-paper group game for family gatherings, parties, classrooms, youth groups, and team events. Each player writes a question beginning with “What if…”, places it in a basket, then draws a question and writes an answer. The papers are collected, redistributed, and read aloud in sequence, creating unexpected and often hilarious combinations.

The humor comes from the mismatch between a question and an unrelated answer. For example, “What if the sky fell?” might be answered with “Then everyone would have to learn to swim.”

The game encourages imagination, creative thinking, and conversation.

## Players and materials

- At least 4 players; 6–12 works especially well.
- One small slip of paper or index card and a pen or pencil per player.
- A basket, bowl, hat, or box.
- Optional: a timer and a theme, such as family, travel, school, animals, or the future.

## Standard round

1. Give each player one slip of paper and a pen.
2. Each player writes a question at the top of the slip beginning with “What if…”. For example: “What if animals could talk?”
3. Players fold their papers and put them in the basket.
4. Mix the papers thoroughly.
5. Each player takes one paper, making sure it is not their own if possible. Exchange or redraw if someone gets their own.
6. Without showing anyone, each player writes an answer to the question on the slip they received.
7. Fold the papers again and return them to the basket.
8. Mix the papers again and redistribute them so everyone has a different slip.
9. Sit or stand in a circle and choose who will begin.
10. The first player reads only the question on their paper.
11. The next player reads only the answer on their paper, then reads the question on that same paper.
12. Continue around the circle: each next player reads the answer on their slip and then the question on that slip. Continue until every player has read both an answer and a question.

The defining read-aloud pattern is: a question, another player's answer, then the question on that answer-reader's slip, continuing around the circle. The answer is meant to mismatch the question just heard; the group should enjoy the surprise rather than explain the connection.

Answers may begin with “Then…” to make the flow clearer, but this is optional.

## Standard rules

- Every question must begin with “What if…”.
- Keep answers short, ideally one sentence, so the reading stays lively.
- Do not show your question or answer to anyone before the reading round.
- Do not explain, defend, or correct an answer while it is being read.
- If someone receives their own paper, have them exchange it with another player or redraw.
- Keep questions respectful; avoid embarrassing, offensive, or overly personal topics.
- After the round, the group may vote for the funniest pairing, strangest question, or best answer.

## Example round

- Player 1: “What if pets could talk?”
- Player 2: “Then the moon would be made of cheese.”
- Player 2: “What if everyone had to wear pajamas to work?”
- Player 3: “Then penguins would rule the world.”
- Player 3: “What if the internet disappeared for a week?”
- Player 4: “Then everyone would become a professional dancer.”

The comedy comes from hearing answers that have little or nothing to do with the questions, and occasionally one that almost makes sense.

## Optional variations

- **Family-friendly round:** Use questions about school, holidays, food, animals, or imaginary inventions.
- **Themed round:** Choose one topic, such as travel, technology, sports, or Guyana.
- **Speed round:** Give players 30 seconds to write their answers.
- **Story round:** After each answer, ask the group to briefly explain how it could connect to the question.
- **Kept-question version:** Instead of redistributing after answers are written, return the original question to its writer for the final reading. This makes the chain more coherent but less surprising.

## Sample prompts

- What if you could teleport anywhere once a year?
- What if animals could vote?
- What if gravity stopped working for one hour?
- What if everyone had to sing instead of speak?
- What if you could swap lives with any historical person for a day?
- What if the internet disappeared for a month?
- What if you could invent one new holiday?
- What if money grew on trees?
- What if you could speak every language in the world?
- What if your home could talk?

## Online mode

The online version uses the same imaginative, mismatched Question/Answer reveal pattern while adapting cards and turns to a shared room.

### Rooms and starting a round

- A room has its own QR join code/link and can have one or more occupants. A playable round requires at least two active players.
- Players join with a nickname; no account is required.
- Nicknames are unique in their room and at most 24 characters long.
- All players mark Ready before a round can start. Once everyone is ready, any active player may start.
- A room can host multiple rounds. New players may join between rounds.
- Rooms expire when empty.

### Online cards and reveal sequence

- Each player submits one hidden card containing both a question and an answer. The question must begin with “What if…”.
- Each question and answer is limited to 500 characters.
- Once all active players have submitted, any active player may distribute the cards. Shuffle and assign whole cards so nobody receives their own.
- The starting player reveals the Question on their assigned card.
- The next player reveals the Answer on their own assigned card, then reveals the Question on that same card. Continue in room order.
- The starting player's Answer is revealed last, closing the chain. Every active player reveals one Answer to complete the round.
- Questions and answers are stored together on a card, but the read-aloud pairing is across successive players: one player's Question is followed by the next player's Answer.
- Keep each card's author name attached to it as the card is shuffled and assigned. Hide authorship until the card's first field is revealed, then identify the author alongside each revealed field from that card.
- Card assignment changes only which card a player reads; it never changes the player's identity, nickname, or browser session.
- Keep the final revealed Answer and completed reveal sequence visible until an active player chooses the next action.

### Ending and reviewing online games

- After a completed round, any active player can choose to start another round or end the game.
- Starting another round saves the completed reveal sequence to the room's history and returns players to the lobby. Everyone must be ready before any player can start the next round.
- Ending the game requires confirmation, saves the completed round, and returns everyone to the lobby. All completed rounds remain available for review, and the room stays open.
- After ending the game, any active player can confirm closing the room. A closed room no longer accepts joins or player access, but its data remains in the Durable Object store. Closing the room does not erase the stored history.

### Online departures and reconnection

- A disconnected player has 30 seconds to reconnect. If they do not return, pause the active round.
- Any active player may remove a disconnected player; all remaining players must mark Ready before the round resumes.
- If a player explicitly leaves during an active round, remove the card assigned to them from that round. Keep their submitted card in play if another player received it.
