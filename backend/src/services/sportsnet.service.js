const env = require('../config/env');

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

    if (url.hostname === 'futbalnet.sportnet.online') {
      url.hostname = 'api.sportnet.online';
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

  if (isNonEmptyString(env.sportsnetTeamId)) {
    url.searchParams.set('teamId', env.sportsnetTeamId.trim());
  }

  if (isNonEmptyString(env.sportsnetCompetitionId)) {
    url.searchParams.set('competitionId', env.sportsnetCompetitionId.trim());
  }

  if (isNonEmptyString(env.sportsnetSeason)) {
    url.searchParams.set('season', env.sportsnetSeason.trim());
  }

  return url.toString();
}

function toIsoDate(value) {
  if (!isNonEmptyString(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapMatch(item, index) {
  const homeTeam = item.homeTeam || item.home_team || item.teamHome || item.host || {};
  const awayTeam = item.awayTeam || item.away_team || item.teamAway || item.guest || {};

  const homeTeamName =
    homeTeam.name ||
    item.homeTeamName ||
    item.home_team_name ||
    item.home ||
    'Domáci';

  const awayTeamName =
    awayTeam.name ||
    item.awayTeamName ||
    item.away_team_name ||
    item.away ||
    'Hostia';

  const round = item.round || item.matchday || item.kolo || null;
  const competition =
    (item.competition && item.competition.name) ||
    item.competitionName ||
    item.competition_name ||
    item.league ||
    null;

  const startsAt = toIsoDate(item.startsAt || item.start_at || item.datetime || item.dateTime || item.date);

  return {
    id: String(item.id || item.matchId || item.uuid || `sportsnet-${index}`),
    startsAt,
    date: startsAt ? startsAt.slice(0, 10) : null,
    time: startsAt ? startsAt.slice(11, 16) : null,
    status: item.status || item.state || item.matchStatus || 'unknown',
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    scoreHome: item.scoreHome ?? item.homeScore ?? item.goalsHome ?? null,
    scoreAway: item.scoreAway ?? item.awayScore ?? item.goalsAway ?? null,
    venue: item.venue || item.stadium || item.location || null,
    round,
    competition,
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
    const apiKey = env.sportsnetApiKey.trim();
    if (isNonEmptyString(env.sportnetApiBase)) {
      headers['X-Api-Key'] = apiKey;
      headers['Content-Type'] = 'application/json';
    } else {
      headers.Authorization = /^(ApiKey|Bearer)\s+/i.test(apiKey)
        ? apiKey
        : `ApiKey ${apiKey}`;
    }
  }

  return headers;
}

async function fetchSportsnetMatches({ forceRefresh = false } = {}) {
  const now = Date.now();

  if (!forceRefresh && cacheState.payload && cacheState.expiresAt > now) {
    return {
      ...cacheState.payload,
      cache: 'HIT'
    };
  }

  const endpoint = buildSportsnetUrl();

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: getHeaders()
    });
  } catch (cause) {
    const error = new Error('Nepodarilo sa pripojiť na Sportsnet API endpoint.');
    error.status = 502;
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`Sportsnet API vrátilo status ${response.status}.`);
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

  const matches = extractMatches(payload);
  const items = matches.map(mapMatch);

  const normalized = {
    source: 'sportsnet.online',
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };

  const cacheTtl = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;
  cacheState.payload = normalized;
  cacheState.expiresAt = now + cacheTtl;

  return {
    ...normalized,
    cache: 'MISS'
  };
}

module.exports = {
  fetchSportsnetMatches
};
