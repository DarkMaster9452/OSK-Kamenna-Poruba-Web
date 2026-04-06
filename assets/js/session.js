(function() {
    'use strict';

    var CANONICAL_PRODUCTION_HOSTS = ['oskkp.sk', 'www.oskkp.sk'];

    function isCanonicalProductionHost(host) {
        return CANONICAL_PRODUCTION_HOSTS.indexOf(String(host || '').toLowerCase()) !== -1;
    }

    function clearApiBaseOverride() {
        try {
            if (window.localStorage) {
                window.localStorage.removeItem('OSK_API_BASE');
            }
        } catch (_) {
            // Ignore storage access failures.
        }
    }

    /**
     * Centralized Session and Auth Logic for OŠK Kamenná Poruba Web
     */

    function resolveApiBase() {
        const host = window.location.hostname;
        const isHttpsPage = window.location.protocol === 'https:';

        if (isCanonicalProductionHost(host)) {
            clearApiBaseOverride();
            return '/api';
        }
        if (host.endsWith('.vercel.app')) {
            return '/api';
        }
        if (host === 'localhost' || host === '127.0.0.1') {
            if (isHttpsPage) {
                return '/api';
            }
            return 'http://localhost:4000/api';
        }
        const configuredRaw = window.localStorage ? window.localStorage.getItem('OSK_API_BASE') : '';
        const configured = String(configuredRaw || '').trim();
        if (configured) {
            const normalized = configured.replace(/\/+$/, '');
            if (isHttpsPage && normalized.startsWith('http://')) {
                return '/api';
            }
            return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
        }

        return '/api';
    }

    const API_BASE = resolveApiBase();
    const SESSION_KEEPALIVE_MS = 10 * 60 * 1000;
    let csrfTokenCache = null;
    let keepAliveTimer = null;
    let syncInFlight = null;

    function readPersistedUser() {
        try {
            const raw = localStorage.getItem('currentUser');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function normalizeUserForComparison(user) {
        if (!user || !user.isLoggedIn) {
            return {
                username: null,
                role: null,
                playerCategory: null,
                parentChildren: [],
                isLoggedIn: false
            };
        }

        return {
            username: user.username || null,
            role: user.role || null,
            playerCategory: user.playerCategory || null,
            parentChildren: Array.isArray(user.parentChildren)
                ? user.parentChildren.map((child) => {
                    if (child && typeof child === 'object') {
                        return child.username || JSON.stringify(child);
                    }
                    return String(child);
                })
                : [],
            isLoggedIn: true
        };
    }

    function authStateChanged(previousUser, nextUser) {
        return JSON.stringify(normalizeUserForComparison(previousUser)) !== JSON.stringify(normalizeUserForComparison(nextUser));
    }

    async function fetchCsrfTokenWithRetry() {
        let lastError = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                const response = await fetch(`${API_BASE}/csrf-token`, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.message || `CSRF endpoint error (${response.status})`);
                }

                const payload = await response.json();
                return payload && payload.csrfToken !== undefined ? payload.csrfToken : '';
            } catch (error) {
                lastError = error;
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 800 * attempt));
                }
            }
        }
        throw lastError || new Error('Nepodarilo sa načítať CSRF token.');
    }

    async function ensureCsrfToken() {
        if (csrfTokenCache) return csrfTokenCache;
        try {
            csrfTokenCache = await fetchCsrfTokenWithRetry();
        } catch (_) {
            const match = document.cookie.match(/(^|;\s*)_csrf=([^;]*)/);
            csrfTokenCache = match ? decodeURIComponent(match[2]) : '';
        }
        return csrfTokenCache;
    }

    async function fetchSessionUser() {
        const response = await fetch(`${API_BASE}/me`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.status === 401 || response.status === 403) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Session endpoint error (${response.status})`);
        }

        const payload = await response.json();
        return payload.user || null;
    }

    async function logout() {
        const csrfToken = await ensureCsrfToken();
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            }
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || 'Odhlásenie zlyhalo. Skús to znova.');
        }

        return clearPersistedUser();
    }

    function persistUser(currentUser) {
        const previousUser = readPersistedUser();
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        if (authStateChanged(previousUser, currentUser)) {
            window.dispatchEvent(new CustomEvent('osk-auth-changed', { detail: currentUser }));
        }
        return currentUser;
    }

    function clearPersistedUser() {
        const previousUser = readPersistedUser();
        localStorage.removeItem('currentUser');
        const clearedUser = { username: null, role: null, playerCategory: null, isLoggedIn: false };
        if (authStateChanged(previousUser, clearedUser)) {
            window.dispatchEvent(new CustomEvent('osk-auth-changed', { detail: { isLoggedIn: false } }));
        }
        return clearedUser;
    }

    async function syncCurrentUserFromSession() {
        let user;

        try {
            user = await fetchSessionUser();
        } catch (error) {
            console.warn('Session check failed:', error);
            const persistedUser = readPersistedUser();
            if (persistedUser && persistedUser.isLoggedIn) {
                return persistedUser;
            }
            throw error;
        }

        if (!user) {
            return clearPersistedUser();
        }

        const currentUser = {
            username: user.username,
            role: user.role,
            playerCategory: user.playerCategory || null,
            parentChildren: user.parentChildren || [],
            isLoggedIn: true
        };

        return persistUser(currentUser);
    }

    async function syncCurrentUserFromSessionWithRetry() {
        let lastError = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                return await syncCurrentUserFromSession();
            } catch (error) {
                lastError = error;
                if (attempt < 3) {
                    await new Promise((resolve) => setTimeout(resolve, attempt * 700));
                }
            }
        }

        throw lastError || new Error('Nepodarilo sa obnoviť používateľskú session.');
    }

    async function syncCurrentUserFromSessionSafe() {
        if (syncInFlight) {
            return syncInFlight;
        }

        syncInFlight = syncCurrentUserFromSessionWithRetry()
            .catch((error) => {
                console.warn('Session sync failed:', error);
                return null;
            })
            .finally(() => {
                syncInFlight = null;
            });

        return syncInFlight;
    }

    function shouldRunKeepAlive() {
        const user = readPersistedUser();
        return Boolean(user && user.isLoggedIn);
    }

    function startSessionKeepAlive() {
        if (keepAliveTimer) {
            window.clearInterval(keepAliveTimer);
        }

        keepAliveTimer = window.setInterval(() => {
            if (!shouldRunKeepAlive()) {
                return;
            }

            syncCurrentUserFromSessionSafe();
        }, SESSION_KEEPALIVE_MS);
    }

    // Export to global scope
    window.OSKSession = {
        getApiBase: () => API_BASE,
        ensureCsrfToken,
        fetchSessionUser,
        handleLogout: logout,
        syncCurrentUserFromSession,
        syncCurrentUserFromSessionWithRetry,
        invalidateCsrfToken: () => { csrfTokenCache = null; }
    };

    // Auto-sync on load if we think we are logged in
    startSessionKeepAlive();

    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && shouldRunKeepAlive()) {
            syncCurrentUserFromSessionSafe();
        }
    });

    window.addEventListener('focus', function() {
        if (shouldRunKeepAlive()) {
            syncCurrentUserFromSessionSafe();
        }
    });

    if (readPersistedUser()) {
        syncCurrentUserFromSessionSafe();
    }
})();
