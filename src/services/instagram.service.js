const env = require('../config/env');

const cacheState = {
  expiresAt: 0,
  payload: null
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function toIsoDate(value) {
  if (!isNonEmptyString(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getUnconfiguredPayload() {
  return {
    source: 'instagram.unconfigured',
    fetchedAt: new Date().toISOString(),
    count: 0,
    items: [],
    cache: 'BYPASS',
    message: 'Instagram feed nie je nakonfigurovany. Nastav INSTAGRAM_ACCESS_TOKEN.'
  };
}

function getUnavailablePayload(message) {
  return {
    source: 'instagram.unavailable',
    fetchedAt: new Date().toISOString(),
    count: 0,
    items: [],
    cache: 'BYPASS',
    message: message || 'Instagram feed sa momentalne nepodarilo nacitat.'
  };
}

function parseInstagramApiErrorMessage(status, body) {
  const rawBody = String(body || '').trim();
  let parsed = null;

  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch (_) {
      parsed = null;
    }
  }

  const apiError = parsed && parsed.error ? parsed.error : null;
  const code = Number(apiError && apiError.code);
  const upstreamMessage = String(apiError && apiError.message || '').trim();

  if (code === 190) {
    return 'Instagram token je neplatny alebo expiroval. Obnov INSTAGRAM_ACCESS_TOKEN.';
  }

  if (status === 400) {
    return upstreamMessage || 'Instagram API odmietlo poziadavku.';
  }

  if (status === 401 || status === 403) {
    return 'Instagram API odmietlo pristup. Skontroluj pristupovy token.';
  }

  if (status >= 500) {
    return 'Instagram API je docasne nedostupne.';
  }

  return upstreamMessage || `Instagram API vratilo status ${status}.`;
}

function normalizeRequestedLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(1, Math.min(100, env.instagramFeedLimit || 8));
  }

  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function buildInstagramUrl(requestedLimit) {
  const userIdRaw = String(env.instagramUserId || 'me').trim();
  const userId = userIdRaw || 'me';

  const url = new URL(`https://graph.instagram.com/${encodeURIComponent(userId)}/media`);
  url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
  url.searchParams.set('access_token', String(env.instagramAccessToken || '').trim());
  // Keep page size moderate and use paging.next for larger limits.
  const pageSize = Math.min(25, requestedLimit);
  url.searchParams.set('limit', String(pageSize));
  return url.toString();
}

function mapInstagramItem(item) {
  const mediaType = String(item.media_type || '').toUpperCase();
  const imageUrl = mediaType === 'VIDEO'
    ? (item.thumbnail_url || item.media_url || null)
    : (item.media_url || item.thumbnail_url || null);

  if (!imageUrl) {
    return null;
  }

  return {
    id: String(item.id || ''),
    caption: isNonEmptyString(item.caption) ? item.caption.trim() : '',
    mediaType,
    imageUrl,
    permalink: isNonEmptyString(item.permalink) ? item.permalink.trim() : null,
    timestamp: toIsoDate(item.timestamp)
  };
}

async function fetchInstagramFeed({ forceRefresh = false, requestedLimit } = {}) {
  if (!isNonEmptyString(env.instagramAccessToken)) {
    return getUnconfiguredPayload();
  }

  const includeAll = String(requestedLimit || '').trim().toLowerCase() === 'all';
  const normalizedLimit = normalizeRequestedLimit(requestedLimit);

  const now = Date.now();
  if (
    !forceRefresh
    && cacheState.payload
    && cacheState.expiresAt > now
    && cacheState.payload.requestedLimit === normalizedLimit
    && Boolean(cacheState.payload.includeAll) === includeAll
  ) {
    return {
      ...cacheState.payload,
      cache: 'HIT'
    };
  }

  try {
    let endpoint = buildInstagramUrl(includeAll ? 25 : normalizedLimit);
    const rows = [];
    let pageCounter = 0;

    while (endpoint && (includeAll || rows.length < normalizedLimit) && pageCounter < 200) {
      pageCounter += 1;

      let response;
      try {
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        });
      } catch (cause) {
        const error = new Error('Nepodarilo sa pripojit na Instagram API.');
        error.status = 502;
        error.cause = cause;
        throw error;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const message = parseInstagramApiErrorMessage(response.status, body);
        const error = new Error(message);
        error.status = response.status >= 500 ? 502 : 400;
        throw error;
      }

      let payload;
      try {
        payload = await response.json();
      } catch (cause) {
        const error = new Error('Instagram API nevratilo validne JSON data.');
        error.status = 502;
        error.cause = cause;
        throw error;
      }

      const pageRows = Array.isArray(payload && payload.data) ? payload.data : [];
      rows.push(...pageRows);

      const nextUrl = payload && payload.paging && payload.paging.next;
      endpoint = typeof nextUrl === 'string' && nextUrl.trim() ? nextUrl : null;
    }

    const items = rows
      .slice(0, includeAll ? rows.length : normalizedLimit)
      .map(mapInstagramItem)
      .filter(Boolean);

    const normalized = {
      source: 'instagram.graph',
      fetchedAt: new Date().toISOString(),
      includeAll,
      requestedLimit: normalizedLimit,
      count: items.length,
      items
    };

    const cacheTtl = Math.max(0, env.instagramCacheSeconds || 0) * 1000;
    cacheState.payload = normalized;
    cacheState.expiresAt = now + cacheTtl;

    return {
      ...normalized,
      cache: 'MISS'
    };
  } catch (error) {
    if (cacheState.payload) {
      return {
        ...cacheState.payload,
        cache: 'STALE',
        warning: error?.message || 'Instagram API fallback na cache.'
      };
    }

    return getUnavailablePayload(error?.message);
  }
}

module.exports = {
  fetchInstagramFeed
};
