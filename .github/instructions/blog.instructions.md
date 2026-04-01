---
description: "Use when editing the blog page, blog post rendering, blogger or coach permissions, or blog create/delete flows in pages/blog.html."
applyTo: "pages/blog.html"
---

# Blog Page Guidelines

- Preserve the split between public post listing and authenticated manage actions.
- Blog writes must continue to use `window.OSKSession.ensureCsrfToken()` and `credentials: 'include'`.
- Keep permission checks aligned with existing roles: `blogger`, `coach`, and `admin` can manage posts with current ownership rules.
- Preserve the page-local post cache and render ordering so UI updates stay in sync after create or delete operations.
