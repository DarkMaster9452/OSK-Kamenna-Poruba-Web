---
description: "Use when editing the tabulka page, standings rendering, Sportsnet integration, Sportsnet info panel, or logo handling in pages/tabulka.html."
applyTo: "pages/tabulka.html"
---

# Tabulka Page Guidelines

- Treat this page as Sportsnet-heavy and preserve the existing `SPORTSNET_INFO` diagnostics panel.
- Keep standings and match normalization logic aligned with the current club-logo registry helpers.
- Preserve graceful handling for unconfigured or failing Sportsnet endpoints instead of surfacing raw fetch errors.
- Keep shared header/footer/session and Cloudinary asset includes unchanged unless the task is specifically about shared chrome.
