/**
 * Cloudinary Assets Utility
 * Fetches root-level Cloudinary assets (logos, sponsors, gallery images, etc.)
 * and replaces [data-cloudinary-id] image src attributes on the page.
 *
 * Usage in HTML:
 *   <img data-cloudinary-id="tomchlad" src="" alt="Tomchlad">
 *   <section data-cloudinary-bg="prva" style="background-image:url('/assets/images/prva.jpg')"></section>
 *   <script src="/assets/js/cloudinary-assets.js"></script>
 *
 * Matching: Cloudinary renames files to e.g. 'tomchlad_xb3fyc'. We match by comparing
 * the base name before the last underscore-suffix against data-cloudinary-id.
 */
(function () {
    var CACHE_KEY = 'osk_cloudinary_assets_v2';
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

    /**
     * Strip Cloudinary's auto-appended random suffix from publicId.
     * E.g. 'tomchlad_xb3fyc' -> 'tomchlad'
     *      'Timber_Nábytok_lqmxmh' -> 'Timber_Nábytok'
     *      'OŠK Kamenná Poruba Logo' -> 'OŠK Kamenná Poruba Logo' (no suffix)
     */
    function stripCloudinarySuffix(publicId) {
        // Cloudinary suffixes are 6 alphanumeric chars after last underscore
        return publicId.replace(/_[a-z0-9]{6}$/i, '');
    }

    function normalizeKey(str) {
        return (str || '').toLowerCase().trim()
            .replace(/\s+/g, '_');
    }

    function buildMap(assets) {
        var map = {};

        assets.forEach(function (a) {
            if (!a.publicId || !a.url) return;
            var url = a.url;
            var id = a.publicId.toLowerCase();
            var normId = normalizeKey(a.publicId);

            // 1. Full publicId variants
            map[id] = url;
            if (normId !== id) map[normId] = url;

            // 2. Filename (with extension)
            if (a.filename) {
                var f = a.filename.toLowerCase();
                map[f] = url;
                var normF = normalizeKey(a.filename);
                if (normF !== f) map[normF] = url;
            }

            // 3. Basename (no extension, no folder)
            var baseParts = a.publicId.split('/');
            var basename = baseParts[baseParts.length - 1];
            var baseLow = basename.toLowerCase();
            var baseNoExt = baseLow.replace(/\.[^.]+$/, '');
            var baseNorm = normalizeKey(baseNoExt);

            map[baseLow] = url;
            map[baseNoExt] = url;
            map[baseNorm] = url;

            // Handle suffix stripping for legacy matching
            var baseStripped = stripCloudinarySuffix(a.publicId).toLowerCase();
            var baseStrippedNoExt = baseStripped.replace(/\.[^.]+$/, '').split('/').pop();
            map[baseStrippedNoExt] = url;
        });

        return map;
    }

    function applyAssets(assets) {
        if (!assets || !assets.length) return;

        var map = buildMap(assets);

        // Update all elements with data-cloudinary-id (for <img>, <div>, <section>, <a>)
        document.querySelectorAll('[data-cloudinary-id]').forEach(function (el) {
            var rawId = el.getAttribute('data-cloudinary-id') || '';
            var id = normalizeKey(rawId);
            if (!id) return;
            var url = map[id] || map[id.replace(/\.[^.]+$/, '')] || null;
            if (!url) return;

            if (el.tagName === 'IMG') {
                el.src = url;
            } else {
                el.style.backgroundImage = 'url("' + url + '")';
            }
        });

        // Support CSS background images via data-cloudinary-bg attribute
        document.querySelectorAll('[data-cloudinary-bg]').forEach(function (el) {
            var rawId = el.getAttribute('data-cloudinary-bg') || '';
            var id = normalizeKey(rawId);
            if (!id) return;
            var url = map[id] || map[id.replace(/\.[^.]+$/, '')] || null;
            if (!url) return;
            // Preserve existing gradient wrappers if present
            var existing = el.style.backgroundImage || '';
            var gradientMatch = existing.match(/^((?:linear|radial)-gradient\s*\((?:\([^)]*\)|[^)])+\))/i);
            if (gradientMatch) {
                el.style.backgroundImage = gradientMatch[1] + ', url("' + url + '")';
            } else {
                el.style.backgroundImage = 'url("' + url + '")';
            }
        });

        // Update favicon if it has data-cloudinary-id
        document.querySelectorAll('link[rel="icon"][data-cloudinary-id]').forEach(function (el) {
            var id = (el.getAttribute('data-cloudinary-id') || '').toLowerCase();
            var url = map[id] || map[id.replace(/\.[^.]+$/, '')] || null;
            if (url) el.href = url;
        });
    }

    function resolveApiBase() {
        var host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:4000/api';
        }
        var configured = localStorage.getItem('OSK_API_BASE');
        if (configured) return (configured.trim().replace(/\/+$/, '') + '/api').replace(/\/api\/api$/, '/api');
        
        return '/api';
    }

    async function loadAndApply() {
        // Check cache first
        var cached = getCache();
        if (cached) {
            applyAssets(cached);
            return;
        }

        try {
            var apiBase = resolveApiBase();
            var response = await fetch(apiBase + '/cloudinary/assets');
            if (!response.ok) return;
            var data = await response.json();
            var assets = Array.isArray(data.assets) ? data.assets : [];
            if (assets && assets.length) {
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
