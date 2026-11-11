# 2026-11-10 — Online What If? game

**Outcome:** The user approved implementation of the online game plan.

**Confirmed decisions**

- Build a room-based online version of the standard What If? party game, preserving the question/answer mismatch and canonical reveal pattern.
- Rooms have individual QR invitation links, allow guest nicknames, can host multiple rounds, and expire when empty. A room may have one occupant, but a round requires at least two players.
- Every player submits a hidden card containing both a “What if…” question and an answer. Once all active players submit, distribute whole cards randomly without assigning anyone their own card.
- Begin with one player revealing their assigned card's Question. Continue in room order with each next player revealing their assigned card's Answer and then Question; the starter reveals their Answer last.
- Permit new players between rounds. Allow 30 seconds for a disconnected player to reconnect; if they do not, pause the active round. Any active player may remove the disconnected player, after which all remaining players must be ready to resume.
- If a player explicitly leaves during a round, remove the card assigned to them but keep their submitted card in play if another player received it.
- Prefer Cloudflare services available on the Free plan, including Durable Objects; document setup and any limits or possible costs.
- Keep interview material in `docs/interviews/`, and maintain canonical game rules and product requirements in `docs/requirements/`.

**Plan:** Implement the multiplayer game, its Cloudflare backend, setup/deployment documentation, and tests. The plan was approved.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
