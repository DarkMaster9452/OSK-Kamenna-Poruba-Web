---
description: "Use when editing the skupiny page, coach or admin group management, player search, or group create/delete flows in pages/skupiny.html."
applyTo: "pages/skupiny.html"
---

# Skupiny Page Guidelines

- Preserve the coach/admin access guard before loading players or groups.
- Keep the relationship between `allPlayers`, `groups`, and the rendered search results straightforward; this page relies on client-side filtering.
- Group create and delete operations must continue to use CSRF-protected requests.
- Keep the page focused on `players` and `groups` endpoints rather than introducing unrelated account-management logic.
