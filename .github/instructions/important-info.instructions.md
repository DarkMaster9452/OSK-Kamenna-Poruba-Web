---
description: "Use when editing the important info page, announcements, polls, role-gated forms, or CSRF-protected notice and poll actions in pages/important_info.html."
applyTo: "pages/important_info.html"
---

# Important Info Page Guidelines

- This page combines announcements and polls in one UI; keep the read and write flows clearly separated.
- Preserve the page-level API wrapper and CSRF handling for create, vote, close, and delete actions.
- Keep role-based visibility and target-category behavior intact for notices and polls.
- If you touch poll scheduling, preserve the existing date/time selector behavior and client-side validation.
