# 2026-11-11 — Room and nickname naming

**Outcome:** The user approved the implementation plan.

## Confirmed decisions

- Require a room name and creator nickname when creating a room; the creator joins automatically as the first player.
- Require a nickname (guest display name, not a login username) when joining.
- Room names and nicknames must be 4–39 characters after trimming.
- Nicknames remain unique within each room. Room names are unique case-insensitively among active rooms.
- Show room names in the active-room directory and room header, including for private rooms. Keep private-room access codes out of directory listings and room state.
- Release room names when their room is closed or expires.

## Approved plan

Add client and server validation, creator auto-join, room-name persistence and directory uniqueness, update the canonical requirements, and add focused Vitest coverage.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
