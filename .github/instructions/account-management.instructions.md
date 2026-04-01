---
description: "Use when editing the account management page, admin-only user management, role assignment, password reset, child assignment, or Sportsnet refresh actions in pages/account_management.html."
applyTo: "pages/account_management.html"
---

# Account Management Page Guidelines

- Preserve the admin-only guard before loading or mutating account data.
- All write operations here should keep `credentials: 'include'` plus CSRF-token handling through `window.OSKSession`.
- Keep role, player-category, and shirt-number validation aligned with the backend `users` and `players` APIs.
- This page also exposes manual Sportsnet refresh actions; keep those utilities separate from the core user-management flows.
