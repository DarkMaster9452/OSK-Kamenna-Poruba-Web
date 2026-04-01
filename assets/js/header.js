(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  CSS                                                                 */
    /* ------------------------------------------------------------------ */
    var CSS = [
        'header.site-header {',
        '    background: linear-gradient(135deg, #003399 0%, #1a5ccc 100%);',
        '    color: white;',
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
        '    font-weight: 500;',
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
        'header.site-header .sh-login-btn {',
        '    background: #ffd700;',
        '    color: #003399;',
        '    text-decoration: none;',
        '    padding: 8px 20px;',
        '    border-radius: 5px;',
        '    font-weight: bold;',
        '    display: inline-block;',
        '    transition: background 0.3s;',
        '    white-space: nowrap;',
        '    overflow: hidden;',
        '    text-overflow: ellipsis;',
        '    max-width: 200px;',
        '    cursor: pointer;',
        '}',
        'header.site-header .sh-login-btn:hover { background: #ffed4e; color: #003399; }',
        'header.site-header .sh-mobile-login { display: none; }',
        'header.site-header .sh-mobile-toggle {',
        '    display: none;',
        '    width: 42px;',
        '    height: 42px;',
        '    border: 1px solid rgba(255,255,255,0.35);',
        '    border-radius: 6px;',
        '    background: transparent;',
        '    color: #fff;',
        '    font-size: 18px;',
        '    align-items: center;',
        '    justify-content: center;',
        '    cursor: pointer;',
        '}',
        '@media (min-width: 1251px) and (max-width: 1450px) {',
        '    header.site-header .header-top { padding: 12px 20px; gap: 10px; }',
        '    header.site-header .sh-nav ul { gap: 8px 12px; font-size: 13px; }',
        '    header.site-header .sh-logo { font-size: 16px; margin-right: 15px; gap: 8px; }',
        '    header.site-header .sh-logo-img { width: 58px; height: 58px; }',
        '    header.site-header .sh-nav a { gap: 4px; }',
        '    header.site-header .sh-login-btn { padding: 8px 12px; font-size: 13px; max-width: 160px; }',
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
        '    header.site-header .sh-nav ul { width: 100%; flex-direction: column; align-items: stretch; gap: 2px; flex-wrap: nowrap; font-size: 13px; }',
        '    header.site-header .sh-nav li { width: 100%; }',
        '    header.site-header .sh-nav a { display: flex; width: 100%; padding: 8px 6px; border-radius: 6px; }',
        '    header.site-header .sh-nav a:active { background: rgba(255,215,0,0.1); }',
        '    header.site-header .sh-mobile-login { display: block; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; }',
        '    header.site-header .sh-mobile-login .sh-login-btn { display: block; width: 100%; max-width: none; text-align: center; padding: 12px; border-radius: 10px; font-size: 15px; }',
        '    header.site-header .sh-actions .sh-login-btn { display: none; }',
        '}'
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

        return [
            '<header class="site-header">',
            '  <div class="header-top">',
            '    <a class="sh-logo" href="/index.html">',
            '      <img src="/assets/images/OŠKKP_logo.png" alt="OŠK Kamenná Poruba Logo" class="sh-logo-img">',
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

    async function logoutWithoutModal(user) {
        var displayName = user && user.username ? user.username : 'týmto účtom';
        var shouldLogout = window.confirm('Si prihlásený ako ' + displayName + '. Chceš sa odhlásiť?');
        if (!shouldLogout) {
            return;
        }

        try {
            var apiBase = window.OSKSession ? window.OSKSession.getApiBase() : '/api';
            var response = await fetch(apiBase + '/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Odhlásenie zlyhalo. Skús to znova.');
            }

            clearStoredAuthState();
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
            var raw = localStorage.getItem('currentUser');
            var user = raw ? JSON.parse(raw) : null;
            if (user && user.isLoggedIn) {
                if (typeof window.openLogoutModal === 'function') {
                    window.openLogoutModal();
                    return;
                }

                await logoutWithoutModal(user);
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
        wrapper.innerHTML = buildHeader();
        var headerElement = wrapper.firstElementChild;
        root.parentNode.insertBefore(headerElement, root);
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
