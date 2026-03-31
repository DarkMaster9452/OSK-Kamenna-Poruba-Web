(function() {
    'use strict';

    /**
     * Centralized Session and Auth Logic for OŠK Kamenná Poruba Web
     */

    function resolveApiBase() {
        const host = window.location.hostname;
        const isHttpsPage = window.location.protocol === 'https:';

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
    let csrfTokenCache = null;

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
        try {
            const response = await fetch(`${API_BASE}/me`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) return null;
            const payload = await response.json();
            return payload.user || null;
        } catch (err) {
            console.warn('Session check failed:', err);
            return null;
        }
    }

    async function syncCurrentUserFromSession() {
        const user = await fetchSessionUser();
        if (!user) {
            localStorage.removeItem('currentUser');
            // Notify other components if needed
            window.dispatchEvent(new CustomEvent('osk-auth-changed', { detail: { isLoggedIn: false } }));
            return null;
        }

        const currentUser = {
            username: user.username,
            role: user.role,
            playerCategory: user.playerCategory || null,
            parentChildren: user.parentChildren || [],
            isLoggedIn: true
        };

        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        window.dispatchEvent(new CustomEvent('osk-auth-changed', { detail: currentUser }));
        return currentUser;
    }

    // Export to global scope
    window.OSKSession = {
        getApiBase: () => API_BASE,
        ensureCsrfToken,
        fetchSessionUser,
        syncCurrentUserFromSession,
        invalidateCsrfToken: () => { csrfTokenCache = null; }
    };

    // Auto-sync on load if we think we are logged in
    if (localStorage.getItem('currentUser')) {
        syncCurrentUserFromSession().catch(console.warn);
    }
})();
