# 2026-11-13 — Round start and card shuffling

**Outcome:** The user approved the implementation plan.

**Confirmed decisions**

- Remove Ready controls and readiness checks throughout the game. Any active player may start a round when there are at least two active players, start a later round, or resume after a disconnected player is removed.
- Allow players to join an active submission phase until cards are shuffled. A joiner is active and must submit a question and answer before shuffling is available.
- Once every active player has submitted, show Shuffle cards to all active players. Any active player may press it; the server must reject joins afterward.
- Preserve existing card assignment, reveal order, reconnect timeout, private-room access rules, and post-round behavior except where removal of readiness gates requires a change.

**Plan:** Update the UI, worker behavior, canonical requirements, and focused Vitest coverage for starting, joining, shuffle availability, and the post-shuffle join lock.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
