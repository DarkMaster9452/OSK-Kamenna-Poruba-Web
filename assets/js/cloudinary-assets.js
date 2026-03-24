/**
 * Cloudinary Assets Utility
 * Fetches root-level Cloudinary assets (logos, illustrations, etc.)
 * and replaces [data-cloudinary-id] image src attributes on the page.
 *
 * Usage in HTML:
 *   <img data-cloudinary-id="OŠK Kamenná Poruba Logo" src="/assets/images/OŠK Kamenná Poruba Logo.png" alt="...">
 *   <script src="/assets/js/cloudinary-assets.js"></script>
 */
(function () {
    var CACHE_KEY = 'osk_cloudinary_assets';
    var CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    function getCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var cached = JSON.parse(raw);
            if (!cached || !cached.ts || !Array.isArray(cached.assets)) return null;
            if (Date.now() - cached.ts > CACHE_TTL) return null;
            return cached.assets;
        } catch (_) { return null; }
    }

    function setCache(assets) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), assets: assets }));
        } catch (_) { }
    }

    function applyAssets(assets) {
        if (!assets || !assets.length) return;

        // Build a lookup map: publicId → url  (case-insensitive)
        var map = {};
        assets.forEach(function (a) {
            map[a.publicId.toLowerCase()] = a.url;
            // Also index by filename without extension for convenience
            var withExt = a.filename ? a.filename.toLowerCase() : '';
            if (withExt) map[withExt] = a.url;
        });

        // Update all elements with data-cloudinary-id
        document.querySelectorAll('[data-cloudinary-id]').forEach(function (el) {
            var id = (el.getAttribute('data-cloudinary-id') || '').toLowerCase();
            if (!id) return;
            var url = map[id] || map[id.replace(/\.[^.]+$/, '')] || null;
            if (!url) return;

            if (el.tagName === 'IMG') {
                el.src = url;
            } else if (el.tagName === 'A' || el.tagName === 'DIV' || el.tagName === 'SECTION') {
                el.style.backgroundImage = 'url("' + url + '")';
            }
        });

        // Also update favicon if it has data-cloudinary-id
        document.querySelectorAll('link[rel="icon"][data-cloudinary-id]').forEach(function (el) {
            var id = (el.getAttribute('data-cloudinary-id') || '').toLowerCase();
            var url = map[id] || map[id.replace(/\.[^.]+$/, '')] || null;
            if (url) el.href = url;
        });
    }

    async function loadAndApply() {
        // Check cache first
        var cached = getCache();
        if (cached) {
            applyAssets(cached);
            return;
        }

        try {
            var response = await fetch('/api/cloudinary/assets');
            if (!response.ok) return;
            var data = await response.json();
            var assets = Array.isArray(data.assets) ? data.assets : [];
            if (assets.length) {
                setCache(assets);
                applyAssets(assets);
            }
        } catch (_) {
            // Silently fail — local fallback images remain
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAndApply);
    } else {
        loadAndApply();
    }
})();
