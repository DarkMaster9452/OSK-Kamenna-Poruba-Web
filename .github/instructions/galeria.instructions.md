---
description: "Use when editing the galeria page, Instagram feed handling, Cloudinary albums, gallery tabs, or gallery caching in pages/galeria.html."
applyTo: "pages/galeria.html"
---

# Galeria Page Guidelines

- This page has two data sources: Instagram feed data and Cloudinary timeline albums. Preserve both flows.
- Keep the existing localStorage cache behavior for Instagram items unless the task explicitly changes cache policy.
- Preserve album-tab generation, `currentAlbum` behavior, and the fallback/error states when backend feeds are empty or unavailable.
- Continue using `window.OSKSession` for API base resolution and shared header/footer behavior.
