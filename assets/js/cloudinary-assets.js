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

    function buildMap(assets) {
        var map = {};

        assets.forEach(function (a) {
            var id = a.publicId.toLowerCase();
            var url = a.url;

            // Full publicId
            map[id] = url;

            // Full filename (with extension)
            if (a.filename) map[a.filename.toLowerCase()] = url;

            // Stripped suffix (base name)
            var base = stripCloudinarySuffix(a.publicId).toLowerCase();
            if (base !== id) map[base] = url;

            // Also strip extension from base
            var baseNoExt = base.replace(/\.[^.]+$/, '');
            if (baseNoExt !== base) map[baseNoExt] = url;
        });

        return map;
    }

    function applyAssets(assets) {
        if (!assets || !assets.length) return;

        var map = buildMap(assets);

        // Update all elements with data-cloudinary-id (for <img>, <div>, <section>, <a>)
        document.querySelectorAll('[data-cloudinary-id]').forEach(function (el) {
            var id = (el.getAttribute('data-cloudinary-id') || '').toLowerCase();
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
            var id = (el.getAttribute('data-cloudinary-bg') || '').toLowerCase();
            if (!id) return;
            var url = map[id] || map[id.replace(/\.[^.]+$/, '')] || null;
            if (!url) return;
            // Preserve existing gradient wrappers if present
            var existing = el.style.backgroundImage || '';
            var gradientMatch = existing.match(/^(linear-gradient\([^)]+\)|radial-gradient\([^)]+\)),\s*/);
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
