# 2026-11-11 — Card author identity during reveals

**Outcome:** The user approved the implementation plan.

**Confirmed decisions**

- Keep each player's identity, nickname, and browser session fixed; only the submitted cards are randomly distributed.
- Attach the author's name to their submitted card.
- Keep authorship hidden until the card's first field is revealed.
- Display the card author's name alongside each revealed Question and Answer from that card.
- Do not label the reveal as though the player reading a field had changed identity.

**Plan:** Preserve author metadata through card assignment and reveal, update the UI and canonical rules, and add tests verifying author attribution and stable player identities. The plan was approved.

**Requirements:** [Online game requirements](../requirements/online-game-requirements.md) · [Canonical game rules](../requirements/what-if-game-rules.md)
