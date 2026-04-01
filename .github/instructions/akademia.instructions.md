---
description: "Use when editing the akademia page, youth roster rendering, Sportsnet player loading, or academy category sections in pages/akademia.html."
applyTo: "pages/akademia.html"
---

# Akademia Page Guidelines

- Preserve the page-local `cachedFetch` and `API_BASE` flow when adjusting roster data loading.
- This page combines backend player data with Sportsnet-derived data; keep category mapping and merge behavior consistent.
- Keep the shared `session.js`, `header.js`, and `footer.js` includes in place.
- If player-card behavior changes, verify that the UI still handles missing remote data gracefully.
