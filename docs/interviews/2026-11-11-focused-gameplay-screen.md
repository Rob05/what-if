# 2026-11-11 — Focused gameplay screen

**Outcome:** The user approved the revised implementation plan.

## Confirmed decisions

- Focus card-entry and reveal screens on the active question/answer task; show only the latest revealed field during the reveal phase.
- Put room sharing, including the QR code, and the player list in a hamburger menu.
- During an active round, Leave game removes only the current player according to existing departure behavior.
- After a round completes, label the same player-only exit Return to lobby; it removes the player from the room and returns them to the app home screen. Do not add a per-player lobby or spectator state.
- Display each completed-round Question with the next Answer in reveal order, including the final Question with the closing Answer. Preserve existing round history.
- Keep essential turn and phase context visible with the active card.

## Approved plan

Refocus the play UI, move room utilities and the contextual exit into the hamburger menu, render completed rounds as question/next-answer pairs, update the online-game requirements, and add focused Vitest coverage.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
