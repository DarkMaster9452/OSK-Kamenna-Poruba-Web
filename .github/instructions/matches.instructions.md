---
description: "Use when editing the matches page, Sportsnet match loading, standings previews, club logos, or Sportsnet status handling in pages/matches.html."
applyTo: "pages/matches.html"
---

# Matches Page Guidelines

- Preserve the Sportsnet-driven flow built around `cachedFetch`, `normalizeSportsnetMatch`, and `SPORTSNET_INFO`.
- Keep unconfigured, empty, and error states explicit in the UI; this page is expected to degrade gracefully when Sportsnet is unavailable.
- Preserve logo registration and lookup logic so club branding stays consistent across cards and detail views.
- Keep shared `session.js`, `header.js`, `cloudinary-assets.js`, and `footer.js` wiring intact.
