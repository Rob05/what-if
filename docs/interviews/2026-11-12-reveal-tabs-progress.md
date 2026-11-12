# 2026-11-12 — Reveal tabs and round progress

**Outcome:** The user approved the implementation plan.

## Confirmed decisions

- Show one **Your card** tab during card submission.
- Automatically shuffle and deal as soon as the final active player submits; no manual distribution action is needed.
- After dealing, show **Your card** and **Progress** tabs, defaulting to **Your card**.
- Preserve the existing reveal sequence: the starter reveals a Question; later players reveal an Answer and then their Question; the starter reveals their Answer last.
- On the card tab, show only the player's currently actionable field before revealing it. Do not preview the other field.
- The Progress tab shows all publicly revealed fields in order, the number revealed, and whose turn is next. It never shows unrevealed card content.
- Switching tabs does not change the turn or interrupt a reveal.
- Preserve no-self-assignment, the reveal order, and completed-round review.

## Approved plan

Automatically distribute cards after the final submission, update the active-round UI with accessible tabs, keep the reveal sequence and private-card boundaries intact, update the canonical online requirements, add focused Vitest coverage, and run the relevant checks.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
