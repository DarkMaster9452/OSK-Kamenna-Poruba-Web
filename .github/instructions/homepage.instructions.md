---
description: "Use when editing the homepage, landing sections, login modals, public announcements, Instagram gallery, or homepage-only API logic in index.html."
applyTo: "index.html"
---

# Homepage Guidelines

- Edit `index.html` as the source; `public/index.html` is generated output.
- This page mixes public landing content with logged-in account flows, so preserve both anonymous and authenticated states.
- Reuse `window.OSKSession` for API base and CSRF helpers, and keep the existing fallback behavior for endpoints that may run on `/api` or local backend URLs.
- Homepage inline helpers are not shared automatically with `pages/*`; if logic needs reuse elsewhere, move it into `assets/js/` instead of assuming other pages can access homepage functions.
- Keep shared header/footer integration intact through `assets/js/header.js` and `assets/js/footer.js`.
