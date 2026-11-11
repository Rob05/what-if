# 2026-11-11 — Round ending, review, and room deletion

**Outcome:** The user approved the implementation plan.

**Confirmed decisions**

- Keep the final revealed answer and completed round visible until a player chooses what happens next.
- Any active player may choose to continue into another round or end the game.
- Confirm ending the game, then return everyone to the lobby while preserving all rounds played in that room for review.
- Provide a confirmed room-deletion option in the lobby after the game is ended. Any active player may confirm it.
- Deleting a room closes access to players and new joins, but retains its data in the Durable Object store.
- Do not offer room deletion during an active round.

**Plan:** Add persistent round history and a post-round/end-game flow; add confirmed room closure; update canonical online-game documentation and tests. The plan was approved.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
