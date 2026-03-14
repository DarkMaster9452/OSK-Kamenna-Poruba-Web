const env = require('../config/env');
const { readCache, writeCache } = require('./cache');

const cacheState = {
  expiresAt: 0,
  payload: null
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildSportsnetUrl() {
  let url;
  if (isNonEmptyString(env.sportnetApiBase)) {
    if (!isNonEmptyString(env.sportnetOrgId)) {
      const error = new Error('SPORTNET_ORG_ID nie je nastavené.');
      error.status = 400;
      throw error;
    }

    try {
      url = new URL(env.sportnetApiBase);
    } catch (error) {
      const invalidUrlError = new Error('SPORTNET_API_BASE má neplatný formát URL.');
      invalidUrlError.status = 400;
      throw invalidUrlError;
    }

    const basePath = String(url.pathname || '').replace(/\/+$/, '');
    const templatePath = String(env.sportnetMatchesPath || '/organizations/{orgId}/matches').trim();
    const resolvedTemplate = templatePath.includes('{orgId}')
      ? templatePath.replace(/\{orgId\}/g, encodeURIComponent(env.sportnetOrgId.trim()))
      : `${templatePath.replace(/\/+$/, '')}/${encodeURIComponent(env.sportnetOrgId.trim())}`;
    const normalizedTemplatePath = `/${resolvedTemplate.replace(/^\/+/, '')}`;
    url.pathname = `${basePath}${normalizedTemplatePath}`.replace(/\/{2,}/g, '/');
  } else {
    if (!isNonEmptyString(env.sportsnetApiUrl)) {
      const error = new Error('SPORTNET_API_BASE alebo SPORTSNET_API_URL nie je nastavené.');
      error.status = 400;
      throw error;
    }

    try {
      url = new URL(env.sportsnetApiUrl);
    } catch (error) {
      const invalidUrlError = new Error('SPORTSNET_API_URL má neplatný formát URL.');
      invalidUrlError.status = 400;
      throw invalidUrlError;
    }
  }

  if (isNonEmptyString(env.sportnetOrgId)) {
    url.searchParams.set('teamAppSpaces', env.sportnetOrgId.trim());
  }

  if (isNonEmptyString(env.sportsnetTeamId)) {
    url.searchParams.set('teamIds', env.sportsnetTeamId.trim());
  }

  if (isNonEmptyString(env.sportsnetCompetitionId)) {
    url.searchParams.set('competitionId', env.sportsnetCompetitionId.trim());
  }

  if (isNonEmptyString(env.sportsnetSeason)) {
    url.searchParams.set('seasonName', env.sportsnetSeason.trim());
  }

  url.searchParams.set('sorter', 'dateFromAsc');
  if (!url.searchParams.has('limit')) {
    url.searchParams.set('limit', '200');
  }

  [
    'apiKey',
    'apikey',
    'api_key',
    'x-api-key',
    'auth',
    'authorization',
    'token',
    'access_token'
  ].forEach((param) => {
    url.searchParams.delete(param);
  });

  return url.toString();
}

function toIsoDate(value) {
  if (!isNonEmptyString(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Convert UTC ISO date to Slovak local date/time (Europe/Bratislava)
function toSlovakDateTime(isoString) {
  if (!isoString) return { date: null, time: null };
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);

  const get = type => (parts.find(p => p.type === type) || {}).value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`
  };
}

function mapMatch(item, index) {
  // SportNet v2 format: teams is an array with additionalProperties.homeaway
  const teams = Array.isArray(item.teams) ? item.teams : [];
  const homeTeamIdx = teams.findIndex(t => t.additionalProperties && t.additionalProperties.homeaway === 'home');
  const awayTeamIdx = teams.findIndex(t => t.additionalProperties && t.additionalProperties.homeaway === 'away');
  const homeTeamObj = (homeTeamIdx >= 0 ? teams[homeTeamIdx] : teams[0]) || {};
  const awayTeamObj = (awayTeamIdx >= 0 ? teams[awayTeamIdx] : teams[1]) || {};

  const homeTeamName = homeTeamObj.name || item.homeTeamName || item.home || 'Domáci';
  const awayTeamName = awayTeamObj.name || item.awayTeamName || item.away || 'Hostia';

  // Score array maps to teams array by index, NOT by home/away
  let scoreHome = null;
  let scoreAway = null;
  if (Array.isArray(item.score)) {
    scoreHome = item.score[homeTeamIdx >= 0 ? homeTeamIdx : 0] ?? null;
    scoreAway = item.score[awayTeamIdx >= 0 ? awayTeamIdx : 1] ?? null;
  } else {
    scoreHome = item.scoreHome ?? item.homeScore ?? null;
    scoreAway = item.scoreAway ?? item.awayScore ?? null;
  }

  let status = 'upcoming';
  if (item.closed === true) {
    status = 'finished';
  } else {
    const rawStatus = String(item.status || item.state || '').toLowerCase();
    if (rawStatus.includes('live')) status = 'live';
    else if (rawStatus.includes('finish') || rawStatus.includes('ended') || rawStatus.includes('completed')) status = 'finished';
    else if (item.startDate && new Date(item.startDate) < new Date()) {
      // Match date has passed but was never closed in SportNet — treat as past
      status = 'finished';
    }
  }

  const round = (item.round && item.round.name) || item.round || item.matchday || null;
  const competition = (item.competition && item.competition.name) || item.competitionName || null;
  const competitionAppSpace = (item.competition && item.competition.appSpace) || null;
  const venue = (item.sportGround && (item.sportGround.name || item.sportGround.city)) || item.venue || item.stadium || null;

  const startsAt = toIsoDate(item.startDate || item.startsAt || item.start_at || item.dateTime || item.date);
  const localDt = toSlovakDateTime(startsAt);

  const matchId = String(item._id || item.id || item.matchId || `sportsnet-${index}`);
  const isRealId = !matchId.startsWith('sportsnet-');

  // Build the direct link to the video recording section on SportNet
  // URL format: https://sportnet.sme.sk/futbalnet/z/{appSpace}/zapas/{matchId}/videozaznam/
  let videoUrl = null;
  if (isRealId && competitionAppSpace) {
    videoUrl = `https://sportnet.sme.sk/futbalnet/z/${encodeURIComponent(competitionAppSpace)}/zapas/${encodeURIComponent(matchId)}/videozaznam/`;
  }

  const detailUrl = item.detailUrl
    || (isRealId ? `https://sportnet.sme.sk/futbalnet/zapas/${encodeURIComponent(matchId)}/` : null);

  return {
    id: matchId,
    startsAt,
    date: localDt.date,
    time: localDt.time,
    status,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    scoreHome,
    scoreAway,
    venue,
    round,
    competition,
    detailUrl,
    videoUrl,
    raw: item
  };
}

function extractMatches(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.matches)) {
    return payload.matches;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (payload.data && Array.isArray(payload.data.matches)) {
    return payload.data.matches;
  }

  if (payload.data && Array.isArray(payload.data.items)) {
    return payload.data.items;
  }

  return [];
}

function getHeaders() {
  const headers = {
    Accept: 'application/json'
  };

  if (isNonEmptyString(env.sportsnetApiKey)) {
    const apiKey = env.sportsnetApiKey
      .trim()
      .replace(/^(ApiKey|Bearer)\s+/i, '')
      .trim();

    if (apiKey) {
      headers.Authorization = `ApiKey ${apiKey}`;
    }
  }

  return headers;
}

function getUnconfiguredPayload() {
  return {
    source: 'sportsnet.unconfigured',
    fetchedAt: new Date().toISOString(),
    count: 0,
    items: [],
    cache: 'BYPASS',
    message: 'Sportsnet endpoint nie je nakonfigurovaný. Nastav SPORTNET_API_URL alebo SPORTNET_API_BASE.'
  };
}

async function fetchSportsnetMatches({ forceRefresh = false } = {}) {
  if (!isNonEmptyString(env.sportsnetApiUrl) && !isNonEmptyString(env.sportnetApiBase)) {
    return getUnconfiguredPayload();
  }

  const now = Date.now();

  // 1) Fast in-memory cache (same container, same process)
  if (!forceRefresh && cacheState.payload && cacheState.expiresAt > now) {
    return {
      ...cacheState.payload,
      cache: 'HIT'
    };
  }

  // 2) Persistent DB cache (survives serverless cold starts)
  if (!forceRefresh) {
    const dbCached = await readCache('matches');
    if (dbCached) {
      // Warm the in-memory cache too
      const cacheTtl = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;
      cacheState.payload = dbCached;
      cacheState.expiresAt = now + cacheTtl;
      return { ...dbCached, cache: 'HIT' };
    }
  }

  const endpoint = buildSportsnetUrl();
  const headers = getHeaders();
  const allMatches = [];
  let offset = 0;
  const maxPages = 10; // safety limit

  for (let page = 0; page < maxPages; page++) {
    const pageUrl = new URL(endpoint);
    if (offset > 0) pageUrl.searchParams.set('offset', String(offset));

    let response;
    try {
      response = await fetch(pageUrl.toString(), { method: 'GET', headers });
    } catch (cause) {
      const error = new Error('Nepodarilo sa pripojiť na Sportsnet API endpoint.');
      error.status = 502;
      error.cause = cause;
      throw error;
    }

    if (!response.ok) {
      let responseBody = '';
      try { responseBody = await response.text(); } catch (_) {}
      const error = new Error(`Sportsnet API vrátilo status ${response.status}. URL: ${pageUrl}. Body: ${responseBody.slice(0, 300)}`);
      error.status = 502;
      throw error;
    }

    const rawBody = await response.text();
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (cause) {
      const error = new Error('Sportsnet endpoint nevrátil validné JSON dáta. Skontroluj SPORTNET_API_BASE/SPORTNET_API_URL.');
      error.status = 502;
      error.cause = cause;
      throw error;
    }

    const pageMatches = extractMatches(payload);
    allMatches.push(...pageMatches);

    // Stop if no more pages
    const nextOffset = payload.nextOffset;
    if (!nextOffset || nextOffset <= offset || pageMatches.length === 0) break;
    offset = nextOffset;
  }

  const items = allMatches.map(mapMatch);

  const normalized = {
    source: 'sportsnet.online',
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };

  const cacheTtl = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;
  cacheState.payload = normalized;
  cacheState.expiresAt = Date.now() + cacheTtl;

  // Fire and forget writing to DB cache
  writeCache('matches', normalized, cacheTtl).catch(console.error);

  return { ...normalized, cache: 'MISS' };
}

module.exports = {
  fetchSportsnetMatches
};
