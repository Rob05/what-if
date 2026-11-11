# 2026-11-11 — Active room directory and private rooms

**Outcome:** The user approved implementation.

**Confirmed decisions**

- Show occupied, open rooms on the landing page, with a lock indicator on private rooms.
- Allow joining only in the lobby or between rounds, consistent with the existing online-game rules.
- Let a room creator choose public or private. Private rooms require a user-defined access code of at least five characters; it is separate from the room ID/invitation link.
- Validate private-room codes on the server and do not expose them in public listings or room state.
- Preserve the existing public room creation and invite-link flow.

**Plan:** Add an active-room directory backed by a shared Durable Object index, private-room creation and server-validated joining, update the requirements and interview archive, and test listing and access behavior.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
