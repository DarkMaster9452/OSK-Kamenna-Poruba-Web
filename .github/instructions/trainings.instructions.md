---
description: "Use when editing the trainings page, training attendance flows, coach actions, player or parent training UI, or assets/js/trainings.js."
applyTo: "pages/trainings.html, assets/js/trainings.js"
---

# Trainings Page Guidelines

- `pages/trainings.html` provides DOM structure and globals expected by `assets/js/trainings.js`; keep IDs, globals, and initialization order stable.
- Preserve role-based behavior for coach, player, and parent workflows when changing render or action logic.
- Training writes and attendance actions should continue to use the shared session and CSRF helpers.
- If you refactor this area, prefer moving logic between `trainings.html` and `assets/js/trainings.js` instead of duplicating it into other pages.
