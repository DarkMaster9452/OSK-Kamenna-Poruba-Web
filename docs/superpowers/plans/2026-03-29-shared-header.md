# Shared Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the site header into a single `assets/js/header.js` file so all pages render an identical mobile header without duplication.

**Architecture:** `header.js` synchronously injects the header HTML + CSS into a `<div id="site-header-root">` placeholder, sets up the mobile toggle, and reads `localStorage.currentUser` to show auth state. On `index.html` the login button delegates to the existing `openLoginModal`/`openLogoutModal` globals; on other pages it redirects to `/index.html`.

**Tech Stack:** Vanilla JS, HTML, CSS (no build step, no dependencies)

---

## File Map

| File | Action |
|---|---|
| `assets/js/header.js` | **CREATE** — injects HTML, CSS, mobile toggle, auth display |
| `index.html` | **MODIFY** — replace static `<header>` with `<div id="site-header-root">`, add `<script src="/assets/js/header.js">`, remove duplicate header CSS, update `updateLoginButtonText()` and `showCoachPlayerCardButton()` to call `window.OSKHeader.refresh()` |
| `pages/*.html` (11 files) | **MODIFY** — same replacement as index.html, remove duplicate header CSS |

---

### Task 1: Create `assets/js/header.js`

**Files:**
- Create: `assets/js/header.js`

- [ ] **Step 1: Create the file with the full implementation**

```js
(function () {
  // ── CSS ──────────────────────────────────────────────────────────────
  var CSS = `
    header.site-header {
        background: linear-gradient(135deg, #003399 0%, #1a5ccc 100%);
        color: white;
        padding: 0;
        position: sticky;
        top: 0;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    header.site-header .header-top {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 20px;
        padding: 20px 40px;
        max-width: 1400px;
        margin: 0 auto;
    }
    header.site-header .sh-logo {
        font-size: 18px;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 15px;
        margin-right: 24px;
        flex-shrink: 0;
        color: white;
        text-decoration: none;
    }
    header.site-header .sh-logo-img {
        width: 72px;
        height: 72px;
        object-fit: contain;
        border-radius: 50%;
        background: white;
        padding: 3px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        display: block;
    }
    header.site-header .sh-nav {
        flex: 1;
        min-width: 0;
    }
    header.site-header .sh-nav ul {
        list-style: none;
        display: flex;
        gap: 12px 24px;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: flex-end;
        margin: 0;
        padding: 0;
    }
    header.site-header .sh-nav li { flex-shrink: 0; }
    header.site-header .sh-nav a {
        color: white;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.3s;
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    header.site-header .sh-nav a:hover { color: #ffd700; }
    header.site-header .sh-nav a::after {
        content: '';
        position: absolute;
        bottom: -5px;
        left: 0;
        width: 0;
        height: 2px;
        background: #ffd700;
        transition: width 0.3s;
    }
    header.site-header .sh-nav a:hover::after { width: 100%; }
    .nav-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ff4c4c;
        margin-left: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 0 2px rgba(255,255,255,0.35);
    }
    header.site-header .sh-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
        flex-shrink: 0;
    }
    header.site-header .sh-login-btn {
        background: #ffd700;
        color: #003399;
        text-decoration: none;
        padding: 8px 20px;
        border-radius: 5px;
        font-weight: bold;
        display: inline-block;
        transition: background 0.3s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
        cursor: pointer;
    }
    header.site-header .sh-login-btn:hover { background: #ffed4e; color: #003399; }
    header.site-header .sh-mobile-login { display: none; }
    header.site-header .sh-mobile-toggle {
        display: none;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,0.35);
        border-radius: 6px;
        background: transparent;
        color: #fff;
        font-size: 18px;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
    @media (max-width: 1100px) {
        header.site-header .header-top { padding: 12px 14px; gap: 10px; position: relative; }
        header.site-header .sh-logo > span { display: none; }
        header.site-header .sh-logo-img { width: 52px; height: 52px; padding: 2px; }
        header.site-header .sh-mobile-toggle { display: inline-flex; }
        header.site-header .sh-nav {
            display: none;
            position: absolute;
            left: 0; right: 0; top: 100%;
            background: linear-gradient(135deg, #003399 0%, #1a5ccc 100%);
            padding: 10px 14px 14px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.22);
            z-index: 1100;
        }
        header.site-header .sh-nav.open { display: block; }
        header.site-header .sh-nav ul { width: 100%; flex-direction: column; align-items: stretch; gap: 6px; flex-wrap: nowrap; font-size: 14px; }
        header.site-header .sh-nav li { width: 100%; }
        header.site-header .sh-nav a { display: flex; width: 100%; padding: 10px 6px; }
        header.site-header .sh-mobile-login { display: list-item; }
        header.site-header .sh-actions .sh-login-btn { display: none; }
    }
  `;

  // ── Helpers ───────────────────────────────────────────────────────────
  var isIndex = (window.location.pathname === '/' || /\/index\.html$/i.test(window.location.pathname));
  var contactHref = isIndex ? '#contact' : '/index.html#contact';
  var loginHref   = isIndex ? '#' : '/index.html';

  function formatUsername(val) {
    var t = String(val || '').trim();
    if (!t) return '';
    return t.length <= 18 ? t : t.slice(0, 17) + '\u2026';
  }

  // ── HTML ──────────────────────────────────────────────────────────────
  var HTML = `
    <header class="site-header">
      <div class="header-top">
        <a class="sh-logo" href="/index.html">
          <img src="/assets/images/OŠKKP_logo.png" alt="OŠK Kamenná Poruba Logo" class="sh-logo-img">
          <span>OŠK Kamenná Poruba</span>
        </a>
        <nav class="sh-nav" id="shMainNav">
          <ul>
            <li><a href="/index.html"><i class="fas fa-home"></i> Domov</a></li>
            <li><a href="/pages/vedenie.html">Vedenie klubu</a></li>
            <li><a href="/pages/atim.html">A-tím</a></li>
            <li><a href="/pages/akademia.html">Akadémia</a></li>
            <li><a href="/pages/matches.html">Zápasy</a></li>
            <li><a href="/pages/galeria.html">Galéria</a></li>
            <li><a href="/pages/blog.html">Blog</a></li>
            <li><a href="${contactHref}">Kontakt</a></li>
            <li id="coachAccountMgmtBtn" style="display:none;"><a href="/pages/account_management.html"><i class="fas fa-users-cog"></i> Správa účtov</a></li>
            <li id="coachGroupsBtn" style="display:none;"><a href="/pages/skupiny.html"><i class="fas fa-layer-group"></i> Skupiny</a></li>
            <li id="shTrainingNavLink" style="display:none;"><a href="/pages/trainings.html"><i class="fas fa-dumbbell"></i> Tréningy</a></li>
            <li id="shInfoNavLink" style="display:none;"><a href="/pages/important_info.html"><i class="fas fa-bullhorn"></i> Dôležité info</a></li>
            <li class="sh-mobile-login"><a href="${loginHref}" class="sh-login-btn" id="shMobileLoginBtn">Prihlásiť sa</a></li>
          </ul>
        </nav>
        <div class="sh-actions">
          <a href="${loginHref}" class="sh-login-btn" id="shLoginBtn">Prihlásiť sa</a>
          <button id="shMobileToggle" class="sh-mobile-toggle" type="button" aria-label="Menu" aria-expanded="false">
            <i class="fas fa-bars"></i>
          </button>
        </div>
      </div>
    </header>
  `;

  // ── Inject CSS ────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── Inject HTML ───────────────────────────────────────────────────────
  var root = document.getElementById('site-header-root');
  if (root) {
    root.outerHTML = HTML;
  }

  // ── Mobile toggle ─────────────────────────────────────────────────────
  function initToggle() {
    var toggle = document.getElementById('shMobileToggle');
    var nav    = document.getElementById('shMainNav');
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.addEventListener('click', function (e) {
      if (e.target instanceof Element && e.target.closest('a')) close();
    });

    document.addEventListener('click', function (e) {
      if (!(e.target instanceof Element)) return;
      if (!e.target.closest('#shMobileToggle') && !e.target.closest('#shMainNav')) close();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1100) close();
    });

    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y > lastY + 10 && nav.classList.contains('open')) close();
      lastY = y;
    }, { passive: true });
  }

  // ── Auth display ──────────────────────────────────────────────────────
  function refreshAuth(user) {
    var loginBtn       = document.getElementById('shLoginBtn');
    var mobileLoginBtn = document.getElementById('shMobileLoginBtn');
    var trainLink      = document.getElementById('shTrainingNavLink');
    var infoLink       = document.getElementById('shInfoNavLink');
    var mgmtBtn        = document.getElementById('coachAccountMgmtBtn');
    var groupsBtn      = document.getElementById('coachGroupsBtn');

    if (user && user.isLoggedIn) {
      var name = formatUsername(user.username || user.name || '');
      if (loginBtn)       { loginBtn.textContent = name || 'Prihlásiť sa'; loginBtn.title = user.username || ''; }
      if (mobileLoginBtn) { mobileLoginBtn.textContent = name || 'Prihlásiť sa'; mobileLoginBtn.title = user.username || ''; }

      var isBlogger = user.role === 'blogger';
      if (trainLink) trainLink.style.display = isBlogger ? 'none' : '';
      if (infoLink)  infoLink.style.display  = isBlogger ? 'none' : '';
      if (mgmtBtn)   mgmtBtn.style.display   = user.role === 'admin' ? '' : 'none';
      if (groupsBtn) groupsBtn.style.display  = (user.role === 'admin' || user.role === 'coach') ? '' : 'none';
    } else {
      if (loginBtn)       { loginBtn.textContent = 'Prihlásiť sa'; loginBtn.title = ''; }
      if (mobileLoginBtn) { mobileLoginBtn.textContent = 'Prihlásiť sa'; mobileLoginBtn.title = ''; }
      if (trainLink) trainLink.style.display = 'none';
      if (infoLink)  infoLink.style.display  = 'none';
      if (mgmtBtn)   mgmtBtn.style.display   = 'none';
      if (groupsBtn) groupsBtn.style.display  = 'none';
    }
  }

  function loadAuthFromStorage() {
    try {
      var stored = localStorage.getItem('currentUser');
      if (stored) refreshAuth(JSON.parse(stored));
    } catch (e) {}
  }

  // ── Login button click ────────────────────────────────────────────────
  function handleLoginClick(e) {
    e.preventDefault();
    if (typeof window.openLoginModal === 'function' || typeof window.openLogoutModal === 'function') {
      // index.html: delegate to existing modal system
      try {
        var stored = localStorage.getItem('currentUser');
        var user = stored ? JSON.parse(stored) : null;
        if (user && user.isLoggedIn && typeof window.openLogoutModal === 'function') {
          window.openLogoutModal();
        } else if (typeof window.openLoginModal === 'function') {
          window.openLoginModal();
        }
      } catch (e2) {
        if (typeof window.openLoginModal === 'function') window.openLoginModal();
      }
    } else {
      window.location.href = '/index.html';
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    initToggle();
    loadAuthFromStorage();

    var loginBtn       = document.getElementById('shLoginBtn');
    var mobileLoginBtn = document.getElementById('shMobileLoginBtn');
    if (loginBtn)       loginBtn.onclick       = handleLoginClick;
    if (mobileLoginBtn) mobileLoginBtn.onclick = handleLoginClick;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API (for index.html to call after login/logout) ───────────
  window.OSKHeader = { refresh: refreshAuth };
})();
```

- [ ] **Step 2: Verify file exists**

```bash
ls assets/js/header.js
```
Expected: file listed

- [ ] **Step 3: Commit**

```bash
git add assets/js/header.js
git commit -m "feat: add shared header.js — injects identical header HTML/CSS/JS on all pages"
```

---

### Task 2: Update `index.html` — replace static header

**Files:**
- Modify: `index.html`

Context: index.html has:
- `<header class="site-header">` block (~lines 2723–2753) — replace with placeholder div
- Header CSS block (~lines 284–428) — remove entirely
- `.nav-dot` CSS (~lines 361–371) — keep (used outside header)
- `updateLoginButtonText()` function (~line 3987) — call `window.OSKHeader.refresh(currentUser)` at end
- `showCoachPlayerCardButton()` function (~line 3242) — also add `window.OSKHeader.refresh(currentUser)` call
- Add `<script src="/assets/js/header.js"></script>` immediately before the `<header>` placeholder

- [ ] **Step 1: Replace static header HTML with placeholder + script tag**

Find this block in index.html (around line 2723):
```html
    <!-- Header -->
    <header class="site-header">
        <div class="header-top">
            ...
        </div>
    </header>
```

Replace with:
```html
    <!-- Header -->
    <script src="/assets/js/header.js"></script>
    <div id="site-header-root"></div>
```

- [ ] **Step 2: Remove header CSS from index.html `<style>` block**

Remove lines from `header.site-header {` through the closing `}` of the `@media (max-width: 1100px)` block for the header (lines ~284–428). Keep `.nav-dot` CSS if it appears elsewhere on the page (search for `.nav-dot` usage first — it's in the nav badge for important_info).

- [ ] **Step 3: Update `updateLoginButtonText()` to call `OSKHeader.refresh`**

At the end of `updateLoginButtonText()` (after `updateHeaderScrollOffset()` call at ~line 4013), add:
```js
if (window.OSKHeader) window.OSKHeader.refresh(currentUser);
```

- [ ] **Step 4: Update `showCoachPlayerCardButton()` to call `OSKHeader.refresh`**

At the end of `showCoachPlayerCardButton()` (after `updateHeaderScrollOffset()` call at ~line 3260), add:
```js
if (window.OSKHeader) window.OSKHeader.refresh(currentUser);
```

- [ ] **Step 5: Remove the old mobile toggle JS block from index.html**

Find and remove the `DOMContentLoaded` listener block in index.html that sets up `shMobileToggle` (starts ~line 3271 with `const mobileMenuToggle = document.getElementById('shMobileToggle')`). This is now handled by `header.js`. Keep the `handleAuthButtonClick` / `loginBtn.onclick` wiring since it delegates to modal — actually `header.js` already handles login button clicks, so remove the `handleAuthButtonClick` and `loginBtn.onclick` / `mobileLoginBtn.onclick` assignments from this block too.

- [ ] **Step 6: Open index.html in browser and verify header renders, mobile toggle works, login button opens modal**

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "refactor: replace static header in index.html with shared header.js"
```

---

### Task 3: Update all `pages/*.html` — replace static headers

**Files:**
- Modify: all 11 files in `pages/`

For **each** page in `pages/`: `atim.html`, `akademia.html`, `blog.html`, `galeria.html`, `matches.html`, `vedenie.html`, `skupiny.html`, `trainings.html`, `important_info.html`, `account_management.html`, `player_detail_coach.html`

Do the following for each file:

- [ ] **Step 1: Replace static `<header class="site-header">...</header>` block**

Replace:
```html
    <header class="site-header">
        <div class="header-top">
            ...
        </div>
    </header>
```

With:
```html
    <script src="/assets/js/header.js"></script>
    <div id="site-header-root"></div>
```

- [ ] **Step 2: Remove header CSS from the page's `<style>` block**

Remove these CSS blocks (they vary slightly per page but all target the same selectors):
- `header.site-header { ... }` and all sub-rules
- `.hamburger-btn { ... }` and `.mobile-nav { ... }` (leftover old CSS, dead code)
- The `@media (max-width: 1100px)` block for the header

- [ ] **Step 3: Remove the old mobile toggle / auth JS block**

Each page has an IIFE at the bottom that handles `shMobileToggle` and reads `localStorage.currentUser`. Remove this entire block since `header.js` now handles it.

Example pattern to find and remove (varies per file):
```js
(function() {
    var toggle = document.getElementById('shMobileToggle');
    var nav = document.getElementById('shMainNav');
    ...
    try {
        var stored = localStorage.getItem('currentUser');
        ...
    } catch(e) {}
})();
```

- [ ] **Step 4: Commit all 11 pages at once**

```bash
git add pages/
git commit -m "refactor: replace static headers in all pages with shared header.js"
```

---

### Task 4: Smoke test

- [ ] **Step 1: Open each page on mobile viewport (375px) in browser DevTools**

Check: header looks identical to index.html, hamburger opens/closes, auth state shows username if logged in.

Pages to check: index, atim, akademia, blog, galeria, matches, vedenie, skupiny, trainings, important_info, account_management.

- [ ] **Step 2: Test login flow on index.html**

Login → username appears in header. Logout → "Prihlásiť sa" reappears. Coach/admin nav items show/hide correctly.

- [ ] **Step 3: Test contact link**

On index.html: clicking "Kontakt" scrolls to `#contact` section.
On pages: clicking "Kontakt" navigates to `/index.html#contact`.
