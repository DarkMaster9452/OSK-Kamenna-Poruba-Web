---
description: "Use when editing the coach player detail page, coach-only player lookup, access guards, or player fetch retry logic in pages/player_detail_coach.html."
applyTo: "pages/player_detail_coach.html"
---

# Player Detail Coach Page Guidelines

- Preserve the centralized session-based access guard for `coach` and `admin` users.
- Keep the player loading flow aligned with the current retry behavior against the `players` API.
- This page is a focused coach view; avoid pulling in unrelated account-management or training-creation logic.
- Keep shared `session.js`, `header.js`, and `footer.js` usage consistent with the rest of the site.
