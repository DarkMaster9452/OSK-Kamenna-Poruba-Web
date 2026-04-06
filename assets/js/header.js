(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  CSS                                                                 */
    /* ------------------------------------------------------------------ */
    var CSS = [
        'header.site-header {',
        '    background: linear-gradient(135deg, #003399 0%, #1a5ccc 100%);',
        '    color: white;',
        '    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;',
        '    line-height: 1.35;',
        '    padding: 0;',
        '    position: sticky;',
        '    top: 0;',
        '    z-index: 1000;',
        '    box-shadow: 0 2px 10px rgba(0,0,0,0.3);',
        '}',
        'header.site-header *, header.site-header *::before, header.site-header *::after { box-sizing: border-box; }',
        'header.site-header .header-top {',
        '    display: flex;',
        '    justify-content: flex-start;',
        '    align-items: center;',
        '    gap: 20px;',
        '    padding: 20px 40px;',
        '    max-width: 1400px;',
        '    margin: 0 auto;',
        '}',
        'header.site-header .sh-logo {',
        '    font-size: 18px;',
        '    font-weight: bold;',
        '    line-height: 1.2;',
        '    display: flex;',
        '    align-items: center;',
        '    gap: 15px;',
        '    margin-right: 24px;',
        '    flex-shrink: 0;',
        '    color: white;',
        '    text-decoration: none;',
        '    white-space: nowrap;',
        '}',
        'header.site-header .sh-logo-img {',
        '    width: 72px;',
        '    height: 72px;',
        '    object-fit: contain;',
        '    border-radius: 50%;',
        '    background: white;',
        '    padding: 3px;',
        '    box-shadow: 0 2px 6px rgba(0,0,0,0.15);',
        '    display: block;',
        '}',
        'header.site-header .sh-nav {',
        '    flex: 1;',
        '    min-width: 0;',
        '}',
        'header.site-header .sh-nav ul {',
        '    list-style: none;',
        '    display: flex;',
        '    gap: 8px 18px;',
        '    flex-wrap: wrap;',
        '    align-items: center;',
        '    justify-content: flex-end;',
        '    margin: 0;',
        '    padding: 0;',
        '}',
        'header.site-header .sh-nav li { flex-shrink: 0; }',
        'header.site-header .sh-nav a {',
        '    color: white;',
        '    text-decoration: none;',
        '    font-size: 15px;',
        '    font-weight: 500;',
        '    line-height: 1.25;',
        '    transition: color 0.3s;',
        '    position: relative;',
        '    display: inline-flex;',
        '    align-items: center;',
        '    gap: 6px;',
        '}',
        'header.site-header .sh-nav a:hover { color: #ffd700; }',
        'header.site-header .sh-nav a::after {',
        '    content: \'\';',
        '    position: absolute;',
        '    bottom: -5px;',
        '    left: 0;',
        '    width: 0;',
        '    height: 2px;',
        '    background: #ffd700;',
        '    transition: width 0.3s;',
        '}',
        'header.site-header .sh-nav a:hover::after { width: 100%; }',
        '.nav-dot {',
        '    width: 10px;',
        '    height: 10px;',
        '    border-radius: 50%;',
        '    background: #ff4c4c;',
        '    margin-left: 6px;',
        '    display: inline-flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '    box-shadow: 0 0 0 2px rgba(255,255,255,0.35);',
        '}',
        'header.site-header .sh-actions {',
        '    display: flex;',
        '    align-items: center;',
        '    gap: 10px;',
        '    margin-left: auto;',
        '    flex-shrink: 0;',
        '}',
        'header.site-header .sh-social-links {',
        '    display: flex;',
        '    align-items: center;',
        '    gap: 12px;',
        '    margin-right: 18px;',
        '    flex-shrink: 0;',
        '}',
        'header.site-header .sh-social-links a {',
        '    color: white;',
        '    font-size: 16px;',
        '    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);',
        '    display: flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '    width: 34px;',
        '    height: 34px;',
        '    border-radius: 50%;',
        '    background: rgba(255,255,255,0.15);',
        '    text-decoration: none;',
        '    border: 1px solid rgba(255,255,255,0.1);',
        '}',
        'header.site-header .sh-social-links a:hover {',
        '    color: #003399;',
        '    background: #ffd700;',
        '    transform: translateY(-3px);',
        '    border-color: #ffd700;',
        '}',
        'header.site-header .sh-login-btn {',
        '    background: #ffd700;',
        '    color: #003399;',
        '    padding: 10px 22px;',
        '    border-radius: 50px;',
        '    font-weight: 700;',
        '    font-size: 14px;',
        '    text-decoration: none;',
        '    transition: all 0.3s ease;',
        '    border: 2px solid transparent;',
        '    display: inline-flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '}',
        'header.site-header .sh-login-btn:hover {',
        '    background: transparent;',
        '    color: #ffd700;',
        '    border-color: #ffd700;',
        '}',
        '@media (max-width: 1200px) {',
        '    header.site-header .sh-social-links { display: none; }',
        '}',
        '.sh-account-modal-backdrop {',
        '    position: fixed;',
        '    inset: 0;',
        '    background: rgba(0,0,0,0.55);',
        '    display: none;',
        '    align-items: center;',
        '    justify-content: center;',
        '    padding: 20px;',
        '    z-index: 3000;',
        '}',
        '.sh-account-modal-backdrop.active { display: flex; }',
        '.sh-account-modal {',
        '    width: min(420px, 100%);',
        '    background: #fff;',
        '    border-radius: 18px;',
        '    padding: 22px;',
        '    box-shadow: 0 18px 50px rgba(0,0,0,0.28);',
        '    color: #1f2937;',
        '    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;',
        '    position: relative;',
        '}',
        '.sh-account-modal, .sh-account-modal *, .sh-account-modal *::before, .sh-account-modal *::after { box-sizing: border-box; }',
        '.sh-account-modal h2 { margin: 0 0 10px; color: #003399; font-size: 28px; }',
        '.sh-account-modal p { margin: 0 0 18px; font-size: 16px; line-height: 1.5; }',
        '.sh-account-modal-close {',
        '    position: absolute;',
        '    top: 12px;',
        '    right: 12px;',
        '    width: 38px;',
        '    height: 38px;',
        '    border: 0;',
        '    border-radius: 50%;',
        '    background: #eef2ff;',
        '    color: #003399;',
        '    cursor: pointer;',
        '    font-size: 18px;',
        '}',
        '.sh-account-modal-close:hover { background: #dbe4ff; }',
        '.sh-account-btn {',
        '    width: 100%;',
        '    border: 0;',
        '    border-radius: 12px;',
        '    padding: 14px 16px;',
        '    font-size: 16px;',
        '    font-weight: 700;',
        '    cursor: pointer;',
        '    display: inline-flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '    gap: 10px;',
        '    margin-bottom: 10px;',
        '}',
        '.sh-account-btn-danger { background: #e74c3c; color: #fff; }',
        '.sh-account-btn-warning { background: #ffd700; color: #003399; }',
        '.sh-account-btn-primary { background: #1a5ccc; color: #fff; margin-bottom: 0; }',
        '.sh-account-form-row { margin-bottom: 14px; }',
        '.sh-account-form-row label { display: block; margin-bottom: 6px; font-weight: 700; color: #334155; }',
        '.sh-account-form-row input { width: 100%; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; font-size: 16px; }',
        '.sh-account-error { display: none; margin-top: 12px; color: #c62828; font-weight: 700; }',
        '.sh-account-success { display: none; margin-top: 12px; color: #15803d; font-weight: 700; }',
        'header.site-header .sh-mobile-login { display: none; }',
        'header.site-header .sh-mobile-toggle {',
        '    display: none;',
        '    width: 42px;',
        '    height: 42px;',
        '    border: 1px solid rgba(255,255,255,0.35);',
        '    border-radius: 6px;',
        '    background: transparent;',
        '    color: #fff;',
        '    font-family: inherit;',
        '    font-size: 18px;',
        '    align-items: center;',
        '    justify-content: center;',
        '    cursor: pointer;',
        '}',
        '@media (min-width: 1251px) and (max-width: 1450px) {',
        '    header.site-header .header-top { padding: 12px 20px; gap: 10px; }',
        '    header.site-header .sh-nav ul { gap: 8px 12px; }',
        '    header.site-header .sh-logo { font-size: 16px; margin-right: 15px; gap: 8px; }',
        '    header.site-header .sh-logo-img { width: 58px; height: 58px; }',
        '    header.site-header .sh-nav a { gap: 4px; font-size: 14px; }',
        '    header.site-header .sh-login-btn { padding: 8px 12px; font-size: 14px; max-width: 160px; }',
        '}',
        '@media (max-width: 1250px) {',
        '    header.site-header .header-top { padding: 10px 14px; gap: 10px; position: relative; }',
        '    header.site-header .sh-logo > span { display: none; }',
        '    header.site-header .sh-logo-img { width: 48px; height: 48px; padding: 2px; }',
        '    header.site-header .sh-mobile-toggle { display: inline-flex; width: 38px; height: 38px; }',
        '    header.site-header .sh-nav {',
        '        display: none;',
        '        position: absolute;',
        '        left: 0; right: 0; top: 100%;',
        '        background: linear-gradient(135deg, #003399 0%, #1a5ccc 100%);',
        '        padding: 8px 14px 14px;',
        '        box-shadow: 0 8px 16px rgba(0,0,0,0.22);',
        '        z-index: 1100;',
        '        max-height: calc(100vh - 80px);',
        '        overflow-y: auto;',
        '    }',
        '    header.site-header .sh-nav.open { display: block; }',
        '    header.site-header .sh-nav ul { width: 100%; flex-direction: column; align-items: stretch; gap: 4px; flex-wrap: nowrap; }',
        '    header.site-header .sh-nav li { width: 100%; }',
        '    header.site-header .sh-nav a { display: flex; width: 100%; padding: 12px 10px; border-radius: 8px; font-size: 16px; font-weight: 600; }',
        '    header.site-header .sh-nav a:active { background: rgba(255,215,0,0.15); }',
        '    header.site-header .sh-mobile-login { display: block; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 15px; }',
        '    header.site-header .sh-mobile-login .sh-login-btn { display: block; width: 100%; max-width: none; text-align: center; padding: 14px; border-radius: 12px; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }',
        '    header.site-header .sh-actions .sh-login-btn { display: none; }',
        '}',
        '@media (max-width: 768px) {',
        '    body > main,',
        '    body > .container {',
        '        padding-top: 18px !important;',
        '    }',
        '    body > .container {',
        '        margin-top: 0 !important;',
        '    }',
        '    body > main > h1:first-child,',
        '    body > main > .page-title:first-child,',
        '    body > .container > h1:first-child,',
        '    body > .container > .page-title:first-child {',
        '        margin: 0 0 18px !important;',
        '        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;',
        '        font-size: 24px !important;',
        '        font-weight: 700 !important;',
        '        line-height: 1.15 !important;',
        '        border: none !important;',
        '        padding-bottom: 0 !important;',
        '        width: auto !important;',
        '        display: flex !important;',
        '        align-items: center;',
        '        gap: 10px;',
        '        flex-wrap: wrap;',
        '    }',
        '    body > main > h1:first-child + *,',
        '    body > main > .page-title:first-child + *,',
        '    body > .container > h1:first-child + *,',
        '    body > .container > .page-title:first-child + * {',
        '        margin-top: 0 !important;',
        '    }',
        '    body > main > .topbar:first-child,',
        '    body > .container > .topbar:first-child {',
        '        margin: 0 0 18px !important;',
        '        align-items: flex-start;',
        '        gap: 10px;',
        '        flex-wrap: wrap;',
        '    }',
        '    body > main > .topbar:first-child h1,',
        '    body > main > .topbar:first-child .title,',
        '    body > .container > .topbar:first-child h1,',
        '    body > .container > .topbar:first-child .title {',
        '        margin: 0 !important;',
        '        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;',
        '        font-size: 24px !important;',
        '        font-weight: 700 !important;',
        '        line-height: 1.15 !important;',
        '        border: none !important;',
        '        padding-bottom: 0 !important;',
        '        width: auto !important;',
        '        display: flex !important;',
        '        align-items: center;',
        '        gap: 10px;',
        '        flex-wrap: wrap;',
        '    }',
        '    body > main > .topbar:first-child + *,',
        '    body > .container > .topbar:first-child + * {',
        '        margin-top: 0 !important;',
        '    }',
        '    body > .main-content > #trainingView > .training-page-section:first-child {',
        '        padding-top: 18px !important;',
        '    }',
        '    body > .main-content > #trainingView > .training-page-section:first-child .training-header:first-child {',
        '        margin: 0 0 18px !important;',
        '        padding-bottom: 0 !important;',
        '        border-bottom: none !important;',
        '    }',
        '    body > .main-content > #trainingView > .training-page-section:first-child .training-header:first-child h2 {',
        '        margin: 0 !important;',
        '        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;',
        '        font-size: 24px !important;',
        '        font-weight: 700 !important;',
        '        line-height: 1.15 !important;',
        '        border: none !important;',
        '        padding-bottom: 0 !important;',
        '        width: auto !important;',
        '        display: flex !important;',
        '        align-items: center;',
        '        gap: 10px;',
        '        flex-wrap: wrap;',
        '    }',
        '    body > .main-content > #trainingView > .training-page-section:first-child .training-header:first-child h2 i {',
        '        margin-right: 0 !important;',
        '    }',
        '}',
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                             */
    /* ------------------------------------------------------------------ */
    function isIndexPage() {
        return (
            window.location.pathname === '/' ||
            /\/index\.html$/i.test(window.location.pathname)
        );
    }

    function buildHeader() {
        var onIndex = isIndexPage();
        var contactHref = onIndex ? '#contact' : '/index.html#contact';
        var loginHref = onIndex ? '#' : '/index.html';

        var socialHtml = [
            '<div class="sh-social-links">',
            '  <a href="https://www.facebook.com/oskkamennaporuba" target="_blank" title="Facebook"><i class="fab fa-facebook-f"></i></a>',
            '  <a href="https://www.instagram.com/osk_kamennaporuba/" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>',
            '  <a href="https://sportnet.sme.sk/futbalnet/k/osk-kamenna-poruba/" target="_blank" title="Futbalnet"><i class="fas fa-globe"></i></a>',
            '</div>'
        ].join('\n');

        return [
            '<header class="site-header">',
            '  <div class="header-top">',
            '    <a class="sh-logo" href="/index.html">',
            '      <img src="https://raw.githubusercontent.com/DarkMaster9452/OSK-Kamenna-Poruba-Web/main/assets/images/O%C5%A0KKP_logo.png" alt="OŠK Kamenná Poruba Logo" class="sh-logo-img">',
            '    </a>',
            '    <nav class="sh-nav" id="shMainNav">',
            '      <ul>',
            '        <li><a href="/index.html"><i class="fas fa-home"></i> Domov</a></li>',
            '        <li><a href="/pages/vedenie.html">Vedenie klubu</a></li>',
            '        <li><a href="/pages/atim.html">A-tím</a></li>',
            '        <li><a href="/pages/akademia.html">Akadémia</a></li>',
            '        <li><a href="/pages/matches.html">Zápasy</a></li>',
            '        <li><a href="/pages/tabulka.html">Tabuľka</a></li>',
            '        <li><a href="/pages/galeria.html">Galéria</a></li>',
            '        <li><a href="/pages/blog.html">Blog</a></li>',
            '        <li><a href="' + contactHref + '">Kontakt</a></li>',
            '        <li id="coachAccountMgmtBtn" style="display:none;"><a href="/pages/account_management.html"><i class="fas fa-users-cog"></i> Správa účtov</a></li>',
            '        <li id="coachGroupsBtn" style="display:none;"><a href="/pages/skupiny.html"><i class="fas fa-layer-group"></i> Skupiny</a></li>',
            '        <li id="shTrainingNavLink" style="display:none;"><a href="/pages/trainings.html"><i class="fas fa-dumbbell"></i> Tréningy</a></li>',
            '        <li id="shInfoNavLink" style="display:none;"><a href="/pages/important_info.html"><i class="fas fa-bullhorn"></i> Dôležité info</a></li>',
            '        <li class="sh-mobile-login"><a href="' + loginHref + '" class="sh-login-btn" id="shMobileLoginBtn">Prihlásiť sa</a></li>',
            '      </ul>',
            '    </nav>',
            '    <div class="sh-actions">',
            '      ' + socialHtml,
            '      <a href="' + loginHref + '" class="sh-login-btn" id="shLoginBtn">Prihlásiť sa</a>',
            '      <button id="shMobileToggle" class="sh-mobile-toggle" type="button" aria-label="Menu" aria-expanded="false">',
            '        <i class="fas fa-bars"></i>',
            '      </button>',
            '    </div>',
            '  </div>',
            '</header>'
        ].join('\n');
    }

    function truncateUsername(name, max) {
        max = max || 18;
        if (name.length <= max) return name;
        return name.slice(0, max - 1) + '\u2026';
    }

    function setBodyScrollLocked(isLocked) {
        document.body.style.overflow = isLocked ? 'hidden' : 'auto';
    }

    function readCurrentUser() {
        try {
            var raw = localStorage.getItem('currentUser');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function buildSharedModals() {
        return [
            '<div class="sh-account-modal-backdrop" id="shAccountModalBackdrop">',
            '  <div class="sh-account-modal" role="dialog" aria-modal="true" aria-labelledby="shAccountModalTitle">',
            '    <button class="sh-account-modal-close" type="button" id="shAccountModalClose" aria-label="Zavrieť">',
            '      <i class="fas fa-times"></i>',
            '    </button>',
            '    <h2 id="shAccountModalTitle">Môj účet</h2>',
            '    <p>Ste prihlásený ako <b id="shAccountUserName"></b>.</p>',
            '    <button class="sh-account-btn sh-account-btn-danger" type="button" id="shLogoutActionBtn"><i class="fas fa-sign-out-alt"></i> Odhlásiť sa</button>',
            '    <button class="sh-account-btn sh-account-btn-warning" type="button" id="shSwitchAccountActionBtn"><i class="fas fa-user-switch"></i> Prepnúť účet</button>',
            '    <button class="sh-account-btn sh-account-btn-primary" type="button" id="shChangePasswordActionBtn"><i class="fas fa-key"></i> Zmeniť heslo</button>',
            '  </div>',
            '</div>',
            '<div class="sh-account-modal-backdrop" id="shChangePasswordBackdrop">',
            '  <div class="sh-account-modal" role="dialog" aria-modal="true" aria-labelledby="shChangePasswordTitle">',
            '    <button class="sh-account-modal-close" type="button" id="shChangePasswordClose" aria-label="Zavrieť">',
            '      <i class="fas fa-times"></i>',
            '    </button>',
            '    <h2 id="shChangePasswordTitle">Zmena hesla</h2>',
            '    <div class="sh-account-form-row">',
            '      <label for="shNewPasswordInput">Nové heslo</label>',
            '      <input id="shNewPasswordInput" type="password" minlength="8" placeholder="Min. 8 znakov">',
            '    </div>',
            '    <div class="sh-account-form-row">',
            '      <label for="shConfirmPasswordInput">Potvrdiť heslo</label>',
            '      <input id="shConfirmPasswordInput" type="password" minlength="8" placeholder="Zopakujte heslo">',
            '    </div>',
            '    <button class="sh-account-btn sh-account-btn-primary" type="button" id="shSubmitPasswordChangeBtn"><i class="fas fa-save"></i> Uložiť zmeny</button>',
            '    <div class="sh-account-error" id="shChangePasswordError"></div>',
            '    <div class="sh-account-success" id="shChangePasswordSuccess"></div>',
            '  </div>',
            '</div>'
        ].join('');
    }

    /* ------------------------------------------------------------------ */
    /*  Auth                                                                */
    /* ------------------------------------------------------------------ */
    function refreshAuth(user) {
        var loginBtn = document.getElementById('shLoginBtn');
        var mobileLoginBtn = document.getElementById('shMobileLoginBtn');
        var trainingLink = document.getElementById('shTrainingNavLink');
        var infoLink = document.getElementById('shInfoNavLink');
        var accountMgmtBtn = document.getElementById('coachAccountMgmtBtn');
        var groupsBtn = document.getElementById('coachGroupsBtn');

        if (user && user.isLoggedIn) {
            var displayName = truncateUsername(user.username || 'Účet');
            if (loginBtn) loginBtn.textContent = displayName;
            if (mobileLoginBtn) mobileLoginBtn.textContent = displayName;

            var role = (user.role || '').toLowerCase();
            var isBlogger = role === 'blogger';
            var isAdmin = role === 'admin';
            var isAdminOrCoach = isAdmin || role === 'coach';
            var canSeeInfo = isAdminOrCoach || isBlogger || role === 'player' || role === 'parent';

            // Show relevant links based on role
            if (trainingLink) trainingLink.style.display = isBlogger ? 'none' : '';
            if (infoLink) infoLink.style.display = canSeeInfo ? '' : 'none';
            if (accountMgmtBtn) accountMgmtBtn.style.display = isAdmin ? '' : 'none';
            if (groupsBtn) groupsBtn.style.display = isAdminOrCoach ? '' : 'none';
        } else {
            if (loginBtn) loginBtn.textContent = 'Prihlásiť sa';
            if (mobileLoginBtn) mobileLoginBtn.textContent = 'Prihlásiť sa';
            if (trainingLink) trainingLink.style.display = 'none';
            if (infoLink) infoLink.style.display = 'none';
            if (accountMgmtBtn) accountMgmtBtn.style.display = 'none';
            if (groupsBtn) groupsBtn.style.display = 'none';
        }
    }

    function loadAuthFromStorage() {
        try {
            var raw = localStorage.getItem('currentUser');
            if (raw) {
                var user = JSON.parse(raw);
                refreshAuth(user);
            }
        } catch (e) {
            // ignore parse errors
        }
    }

    function clearStoredAuthState() {
        try {
            localStorage.removeItem('currentUser');
        } catch (e) {
            // ignore storage errors
        }

        refreshAuth({ isLoggedIn: false });
        window.dispatchEvent(new CustomEvent('osk-auth-changed', {
            detail: { isLoggedIn: false }
        }));
    }

    async function performLogout() {
        try {
            if (window.OSKSession && typeof window.OSKSession.handleLogout === 'function') {
                await window.OSKSession.handleLogout();
            } else {
                throw new Error('Odhlásenie nie je momentálne dostupné.');
            }

            clearStoredAuthState();
        } catch (error) {
            throw error;
        }
    }

    function openAccountModal(user) {
        var backdrop = document.getElementById('shAccountModalBackdrop');
        var userName = document.getElementById('shAccountUserName');
        if (!backdrop) {
            return;
        }

        if (userName) {
            userName.textContent = user && user.username ? user.username : 'Účet';
        }

        backdrop.classList.add('active');
        setBodyScrollLocked(true);
    }

    function closeAccountModal() {
        var backdrop = document.getElementById('shAccountModalBackdrop');
        if (!backdrop) {
            return;
        }

        backdrop.classList.remove('active');
        setBodyScrollLocked(false);
    }

    function openChangePasswordModalShared() {
        var backdrop = document.getElementById('shChangePasswordBackdrop');
        var errorNode = document.getElementById('shChangePasswordError');
        var successNode = document.getElementById('shChangePasswordSuccess');
        if (!backdrop) {
            return;
        }

        closeAccountModal();
        if (errorNode) {
            errorNode.textContent = '';
            errorNode.style.display = 'none';
        }
        if (successNode) {
            successNode.textContent = '';
            successNode.style.display = 'none';
        }

        backdrop.classList.add('active');
        setBodyScrollLocked(true);
    }

    function closeChangePasswordModalShared() {
        var backdrop = document.getElementById('shChangePasswordBackdrop');
        var newPasswordInput = document.getElementById('shNewPasswordInput');
        var confirmPasswordInput = document.getElementById('shConfirmPasswordInput');
        var errorNode = document.getElementById('shChangePasswordError');
        var successNode = document.getElementById('shChangePasswordSuccess');

        if (backdrop) {
            backdrop.classList.remove('active');
        }
        if (newPasswordInput) {
            newPasswordInput.value = '';
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.value = '';
        }
        if (errorNode) {
            errorNode.textContent = '';
            errorNode.style.display = 'none';
        }
        if (successNode) {
            successNode.textContent = '';
            successNode.style.display = 'none';
        }
        setBodyScrollLocked(false);
    }

    async function submitSharedPasswordChange() {
        var newPasswordInput = document.getElementById('shNewPasswordInput');
        var confirmPasswordInput = document.getElementById('shConfirmPasswordInput');
        var errorNode = document.getElementById('shChangePasswordError');
        var successNode = document.getElementById('shChangePasswordSuccess');
        var newPassword = newPasswordInput ? String(newPasswordInput.value || '').trim() : '';
        var confirmPassword = confirmPasswordInput ? String(confirmPasswordInput.value || '').trim() : '';

        if (errorNode) {
            errorNode.textContent = '';
            errorNode.style.display = 'none';
        }
        if (successNode) {
            successNode.textContent = '';
            successNode.style.display = 'none';
        }

        if (newPassword.length < 8) {
            if (errorNode) {
                errorNode.textContent = 'Nové heslo musí mať aspoň 8 znakov.';
                errorNode.style.display = 'block';
            }
            return;
        }

        if (newPassword !== confirmPassword) {
            if (errorNode) {
                errorNode.textContent = 'Heslá sa nezhodujú.';
                errorNode.style.display = 'block';
            }
            return;
        }

        try {
            var apiBase = window.OSKSession ? window.OSKSession.getApiBase() : '/api';
            var csrfToken = window.OSKSession ? await window.OSKSession.ensureCsrfToken() : '';
            var response = await fetch(apiBase + '/change-password', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({ newPassword: newPassword })
            });
            var payload = await response.json().catch(function () { return {}; });
            if (!response.ok) {
                throw new Error(payload.message || 'Zmena hesla zlyhala.');
            }

            if (successNode) {
                successNode.textContent = 'Heslo bolo úspešne zmenené.';
                successNode.style.display = 'block';
            }

            window.setTimeout(function () {
                closeChangePasswordModalShared();
            }, 900);
        } catch (error) {
            if (errorNode) {
                errorNode.textContent = error && error.message ? error.message : 'Zmena hesla zlyhala.';
                errorNode.style.display = 'block';
            }
        }
    }

    async function handleSwitchAccountShared() {
        try {
            await performLogout();
            closeAccountModal();
            closeChangePasswordModalShared();

            if (typeof window.openLoginModal === 'function') {
                window.openLoginModal();
                return;
            }

            try {
                sessionStorage.setItem('osk-open-login-modal', '1');
            } catch (e) {
                // ignore storage errors
            }

            window.location.href = '/index.html';
        } catch (error) {
            window.alert(error && error.message ? error.message : 'Prepnutie účtu zlyhalo.');
        }
    }

    async function handleLogoutShared() {
        try {
            await performLogout();
            closeAccountModal();
        } catch (error) {
            window.alert(error && error.message ? error.message : 'Odhlásenie zlyhalo. Skús to znova.');
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Login button click handler                                          */
    /* ------------------------------------------------------------------ */
    async function handleLoginClick(e) {
        e.preventDefault();
        try {
            var user = readCurrentUser();
            if (user && user.isLoggedIn) {
                openAccountModal(user);
                return;
            } else {
                if (typeof window.openLoginModal === 'function') {
                    window.openLoginModal();
                    return;
                }
            }
        } catch (e) {
            // ignore
        }
        window.location.href = '/index.html';
    }

    /* ------------------------------------------------------------------ */
    /*  Mobile toggle                                                       */
    /* ------------------------------------------------------------------ */
    function initToggle() {
        var toggle = document.getElementById('shMobileToggle');
        var nav = document.getElementById('shMainNav');
        if (!toggle || !nav) return;

        function closeNav() {
            if (nav) nav.classList.remove('open');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }

        function openNav() {
            if (nav) nav.classList.add('open');
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
        }

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            if (nav.classList.contains('open')) {
                closeNav();
            } else {
                openNav();
            }
        });

        // Close when clicking outside
        document.addEventListener('click', function (e) {
            if (nav && !nav.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
                closeNav();
            }
        });

        // Close when a link inside nav is clicked
        nav.addEventListener('click', function (e) {
            if (e.target.closest('a')) {
                closeNav();
            }
        });

        // Close on resize above breakpoint
        window.addEventListener('resize', function () {
            if (window.innerWidth > 1100 && nav && nav.classList.contains('open')) {
                closeNav();
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Inject CSS                                                          */
    /* ------------------------------------------------------------------ */
    function injectCSS() {
        if (document.getElementById('osk-header-styles')) return;
        var style = document.createElement('style');
        style.id = 'osk-header-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /*  Inject HTML                                                         */
    /* ------------------------------------------------------------------ */
    function injectHeader() {
        var root = document.getElementById('site-header-root');
        if (!root) return;
        var wrapper = document.createElement('div');
        wrapper.innerHTML = buildHeader() + buildSharedModals();
        var headerElement = wrapper.firstElementChild;
        root.parentNode.insertBefore(headerElement, root);
        while (wrapper.children.length > 0) {
            root.parentNode.insertBefore(wrapper.children[0], root);
        }
        root.remove();
        
        // Add listener for auth changes from session.js
        window.addEventListener('osk-auth-changed', function(e) {
            refreshAuth(e.detail);
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Attach login button handlers                                        */
    /* ------------------------------------------------------------------ */
    function attachLoginHandlers() {
        var loginBtn = document.getElementById('shLoginBtn');
        var mobileLoginBtn = document.getElementById('shMobileLoginBtn');
        if (loginBtn) loginBtn.addEventListener('click', handleLoginClick);
        if (mobileLoginBtn) mobileLoginBtn.addEventListener('click', handleLoginClick);
    }

    function attachAccountModalHandlers() {
        var accountBackdrop = document.getElementById('shAccountModalBackdrop');
        var accountClose = document.getElementById('shAccountModalClose');
        var logoutBtn = document.getElementById('shLogoutActionBtn');
        var switchAccountBtn = document.getElementById('shSwitchAccountActionBtn');
        var changePasswordBtn = document.getElementById('shChangePasswordActionBtn');
        var changePasswordBackdrop = document.getElementById('shChangePasswordBackdrop');
        var changePasswordClose = document.getElementById('shChangePasswordClose');
        var submitPasswordBtn = document.getElementById('shSubmitPasswordChangeBtn');

        if (accountClose) accountClose.addEventListener('click', closeAccountModal);
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogoutShared);
        if (switchAccountBtn) switchAccountBtn.addEventListener('click', handleSwitchAccountShared);
        if (changePasswordBtn) changePasswordBtn.addEventListener('click', openChangePasswordModalShared);
        if (changePasswordClose) changePasswordClose.addEventListener('click', closeChangePasswordModalShared);
        if (submitPasswordBtn) submitPasswordBtn.addEventListener('click', submitSharedPasswordChange);

        if (accountBackdrop) {
            accountBackdrop.addEventListener('click', function (e) {
                if (e.target === accountBackdrop) {
                    closeAccountModal();
                }
            });
        }

        if (changePasswordBackdrop) {
            changePasswordBackdrop.addEventListener('click', function (e) {
                if (e.target === changePasswordBackdrop) {
                    closeChangePasswordModalShared();
                }
            });
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Init                                                                */
    /* ------------------------------------------------------------------ */
    // Step 1: inject CSS immediately (head is available since script is in head)
    injectCSS();

    // Step 2: inject HTML — must wait for the placeholder to exist in DOM
    function init() {
        injectHeader();
        initToggle();
        loadAuthFromStorage();
        attachLoginHandlers();
        attachAccountModalHandlers();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ------------------------------------------------------------------ */
    /*  Public API                                                          */
    /* ------------------------------------------------------------------ */
    window.OSKHeader = {
        refresh: refreshAuth
    };

}());
