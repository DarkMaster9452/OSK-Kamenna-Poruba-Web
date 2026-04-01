const env = require('../config/env');
const { readCache, writeCache } = require('./cache');

const cacheState = {
  expiresAt: 0,
  payload: null
};

const detailCacheState = new Map();

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeComparable(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

function resolveSportsnetBaseUrl() {
  let url;

  try {
    url = isNonEmptyString(env.sportnetApiBase)
      ? new URL(env.sportnetApiBase)
      : new URL(env.sportsnetApiUrl);
  } catch (error) {
    const invalidUrlError = new Error('Sportnet detail endpoint má neplatný formát URL.');
    invalidUrlError.status = 400;
    throw invalidUrlError;
  }

  const path = String(url.pathname || '').replace(/\/+$/, '');
  const organizationsIndex = path.indexOf('/organizations/');
  const matchesIndex = path.indexOf('/matches');

  if (organizationsIndex >= 0) {
    url.pathname = path.slice(0, organizationsIndex) || '/';
  } else if (matchesIndex >= 0) {
    url.pathname = path.slice(0, matchesIndex) || '/';
  } else {
    url.pathname = path || '/';
  }

  url.search = '';
  url.hash = '';

  return url;
}

function buildSportsnetDetailUrl(matchId, { forceRefresh = false } = {}) {
  const url = resolveSportsnetBaseUrl();
  const basePath = String(url.pathname || '').replace(/\/+$/, '');
  url.pathname = `${basePath}/matches/${encodeURIComponent(String(matchId || '').trim())}`.replace(/\/{2,}/g, '/');

  if (forceRefresh) {
    url.searchParams.set('noCache', '1');
  }

  return url.toString();
}

function toIsoDate(value) {
  if (!isNonEmptyString(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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

  const get = (type) => (parts.find((part) => part.type === type) || {}).value || '';

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`
  };
}

function getMatchTeams(item) {
  const teams = Array.isArray(item?.teams) ? item.teams : [];
  const homeTeamIdx = teams.findIndex((team) => team?.additionalProperties?.homeaway === 'home');
  const awayTeamIdx = teams.findIndex((team) => team?.additionalProperties?.homeaway === 'away');

  return {
    teams,
    homeTeamIdx,
    awayTeamIdx,
    homeTeamObj: (homeTeamIdx >= 0 ? teams[homeTeamIdx] : teams[0]) || {},
    awayTeamObj: (awayTeamIdx >= 0 ? teams[awayTeamIdx] : teams[1]) || {}
  };
}

function getTeamName(teamObj, fallback) {
  return teamObj?.name || teamObj?.displayName || fallback;
}

function getTeamLogo(teamObj) {
  if (!teamObj) return null;
  if (teamObj.logo && typeof teamObj.logo === 'object') {
    return teamObj.logo.public_url || teamObj.logo.media_url || null;
  }
  return teamObj.logo_public_url || teamObj.logo || null;
}

function resolveScore(item, homeTeamIdx, awayTeamIdx) {
  if (Array.isArray(item?.score)) {
    return {
      scoreHome: item.score[homeTeamIdx >= 0 ? homeTeamIdx : 0] ?? null,
      scoreAway: item.score[awayTeamIdx >= 0 ? awayTeamIdx : 1] ?? null
    };
  }

  return {
    scoreHome: item?.scoreHome ?? item?.homeScore ?? null,
    scoreAway: item?.scoreAway ?? item?.awayScore ?? null
  };
}

function getMatchStatus(item, startsAt) {
  if (item?.closed === true) {
    return 'finished';
  }

  const rawStatus = normalizeComparable(item?.status || item?.state);
  if (rawStatus.includes('live') || rawStatus.includes('prebieha')) {
    return 'live';
  }
  if (rawStatus.includes('finish') || rawStatus.includes('ended') || rawStatus.includes('completed') || rawStatus.includes('odohraty')) {
    return 'finished';
  }
  if (startsAt && new Date(startsAt) < new Date()) {
    return 'finished';
  }
  return 'upcoming';
}

function getCompetitionName(item) {
  const competition = item?.competition?.name || item?.competitionName || null;
  if (competition === 'undefined' || competition === 'null' || !competition) {
    return 'Súťaž';
  }
  return competition;
}

function getCompetitionAppSpace(item) {
  return item?.competition?.appSpace || null;
}

function getVenue(item) {
  return item?.sportGround?.displayName
    || item?.sportGround?.name
    || item?.sportGround?.sportObjectName
    || item?.sportGround?.city
    || item?.venue
    || item?.stadium
    || null;
}

function normalizeEventType(value) {
  const normalized = normalizeComparable(value).replace(/[_\s]+/g, '-');
  if (!normalized) return '';
  if (normalized === 'own-goal' || normalized === 'goal-own' || normalized === 'owngoal') return 'goal-own';
  if (normalized === 'penalty-goal' || normalized === 'goal-penalty' || normalized === 'penaltygoal') return 'penalty';
  if (normalized === 'yellow' || normalized === 'yellowcard') return 'yellow-card';
  if (normalized === 'red' || normalized === 'redcard') return 'red-card';
  return normalized;
}

function getEventIcon(type) {
  if (type === 'yellow-card') return '🟨';
  if (type === 'red-card') return '🟥';
  return '⚽';
}

function getDisplayName(entity, fallback = 'Neznámy hráč') {
  if (!entity) return fallback;
  if (isNonEmptyString(entity.displayName)) return entity.displayName.trim();

  const nameParts = [];
  [entity.name, entity.surname].forEach((part) => {
    if (isNonEmptyString(part) && !nameParts.includes(part.trim())) {
      nameParts.push(part.trim());
    }
  });

  if (nameParts.length > 0) {
    return nameParts.join(' ');
  }

  return fallback;
}

function getTeamIdentifiers(teamObj) {
  return new Set(
    [teamObj?._id, teamObj?.id, teamObj?.appSpace, teamObj?.name, teamObj?.displayName]
      .filter(isNonEmptyString)
      .map(normalizeComparable)
  );
}

function resolveTeamSide(teamValue, context, fallbackSide = 'away') {
  if (typeof teamValue === 'number') {
    if (teamValue === context.homeTeamIdx) return 'home';
    if (teamValue === context.awayTeamIdx) return 'away';
  }

  const normalized = normalizeComparable(
    typeof teamValue === 'object'
      ? teamValue?._id || teamValue?.id || teamValue?.name || teamValue?.displayName || teamValue?.appSpace
      : teamValue
  );

  if (!normalized) {
    return fallbackSide;
  }
  if (normalized === 'home' || normalized === 'domaci') return 'home';
  if (normalized === 'away' || normalized === 'hostia') return 'away';

  const homeIdentifiers = getTeamIdentifiers(context.homeTeamObj);
  const awayIdentifiers = getTeamIdentifiers(context.awayTeamObj);

  if (homeIdentifiers.has(normalized)) return 'home';
  if (awayIdentifiers.has(normalized)) return 'away';

  return fallbackSide;
}

function parseEventMinute(event) {
  const rawMinute = event?.minute;
  if (typeof rawMinute === 'number' && Number.isFinite(rawMinute)) {
    return rawMinute;
  }

  if (isNonEmptyString(rawMinute)) {
    const parsed = Number.parseInt(rawMinute, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (isNonEmptyString(event?.eventTime)) {
    const parsed = Number.parseInt(String(event.eventTime).split(':')[0], 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function mapMatchEvent(event, context) {
  const type = normalizeEventType(event?.eventType || event?.type);
  if (!type) {
    return null;
  }

  const minute = parseEventMinute(event);
  const player = getDisplayName(
    event?.player || event?.crewMember || event?.replacement,
    event?.playerName || event?.player || 'Neznámy hráč'
  );
  const fallbackSide = typeof event?.teamIdx === 'number' && event.teamIdx === context.homeTeamIdx ? 'home' : 'away';
  const team = resolveTeamSide(event?.team || event?.teamId || event?.teamIdx, context, fallbackSide);

  return {
    type,
    minute,
    player,
    team,
    icon: getEventIcon(type)
  };
}

function extractMappedEvents(item, context) {
  const sourceEvents = Array.isArray(item?.protocol?.events) && item.protocol.events.length > 0
    ? item.protocol.events
    : Array.isArray(item?.events)
      ? item.events
      : [];

  return sourceEvents
    .map((event) => mapMatchEvent(event, context))
    .filter(Boolean);
}

function isPrimaryRefereePosition(value) {
  const normalized = normalizeComparable(value);
  if (!normalized) return false;
  if (normalized.includes('assistant') || normalized.includes('asistent')) return false;
  if (normalized.includes('delegate') || normalized.includes('delegat')) return false;
  if (normalized.includes('coach') || normalized.includes('trener')) return false;
  if (normalized.includes('veduci')) return false;

  return normalized === 'r'
    || normalized === 'hr'
    || normalized === 'ref'
    || normalized === 'referee'
    || normalized.includes('hlavny rozhodca')
    || normalized.includes('rozhodca');
}

function extractRefereeNameFromEntries(entries, getPosition, getPerson) {
  for (const entry of entries) {
    if (!isPrimaryRefereePosition(getPosition(entry))) {
      continue;
    }

    const name = getDisplayName(getPerson(entry), null);
    if (isNonEmptyString(name)) {
      return name;
    }
  }

  return null;
}

function extractReferee(item) {
  const explicitCandidates = [
    item?.referee,
    item?.mainReferee,
    item?.protocol?.referee,
    item?.officialReferee
  ];

  for (const candidate of explicitCandidates) {
    if (isNonEmptyString(candidate)) {
      return candidate.trim();
    }
    const name = getDisplayName(candidate, null);
    if (isNonEmptyString(name)) {
      return name;
    }
  }

  const nominationCrew = Array.isArray(item?.nominations)
    ? item.nominations.flatMap((nomination) => (Array.isArray(nomination?.crew) ? nomination.crew : []))
    : [];
  const refereeFromCrew = extractRefereeNameFromEntries(
    nominationCrew,
    (entry) => entry?.position,
    (entry) => entry?.sportnetUser || entry?.user
  );
  if (refereeFromCrew) {
    return refereeFromCrew;
  }

  const managers = Array.isArray(item?.managers) ? item.managers : [];
  const refereeFromManagers = extractRefereeNameFromEntries(
    managers,
    (entry) => [entry?.type?.label, entry?.type?.value, ...(Array.isArray(entry?.roles) ? entry.roles : [])].filter(Boolean).join(' '),
    (entry) => entry?.user
  );

  return refereeFromManagers || null;
}

function mapMatch(item, index = 0) {
  const context = getMatchTeams(item);
  const homeTeamName = getTeamName(context.homeTeamObj, item?.homeTeamName || item?.home || 'Domáci');
  const awayTeamName = getTeamName(context.awayTeamObj, item?.awayTeamName || item?.away || 'Hostia');
  const homeLogo = getTeamLogo(context.homeTeamObj);
  const awayLogo = getTeamLogo(context.awayTeamObj);
  const { scoreHome, scoreAway } = resolveScore(item, context.homeTeamIdx, context.awayTeamIdx);
  const startsAt = toIsoDate(item?.startDate || item?.startsAt || item?.start_at || item?.dateTime || item?.date);
  const localDt = toSlovakDateTime(startsAt);
  const status = getMatchStatus(item, startsAt);
  const round = (item?.round && item.round.name) || item?.round || item?.matchday || null;
  const competition = getCompetitionName(item);
  const competitionAppSpace = getCompetitionAppSpace(item);
  const venue = getVenue(item);
  const matchId = String(item?._id || item?.id || item?.matchId || `sportsnet-${index}`);
  const isRealId = !matchId.startsWith('sportsnet-');

  let videoUrl = null;
  if (isRealId && competitionAppSpace) {
    videoUrl = `https://sportnet.sme.sk/futbalnet/z/${encodeURIComponent(competitionAppSpace)}/zapas/${encodeURIComponent(matchId)}/videozaznam/`;
  }

  const detailUrl = item?.detailUrl
    || (isRealId ? `https://sportnet.sme.sk/futbalnet/zapas/${encodeURIComponent(matchId)}/` : null);

  return {
    id: matchId,
    startsAt,
    date: localDt.date,
    time: localDt.time,
    status,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    homeLogo,
    awayLogo,
    scoreHome,
    scoreAway,
    venue,
    round,
    competition,
    referee: extractReferee(item),
    detailUrl,
    videoUrl,
    events: extractMappedEvents(item, context),
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

function getUnconfiguredDetailPayload(matchId) {
  return {
    source: 'sportsnet.unconfigured',
    fetchedAt: new Date().toISOString(),
    matchId: String(matchId || ''),
    item: null,
    cache: 'BYPASS',
    message: 'Sportsnet endpoint nie je nakonfigurovaný. Nastav SPORTNET_API_URL alebo SPORTNET_API_BASE.'
  };
}

async function fetchSportsnetJson(url) {
  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (cause) {
    const error = new Error('Nepodarilo sa pripojiť na Sportsnet API endpoint.');
    error.status = 502;
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch (_) {
      responseBody = '';
    }

    const error = new Error(`Sportsnet API vrátilo status ${response.status}. URL: ${url}. Body: ${responseBody.slice(0, 300)}`);
    error.status = 502;
    throw error;
  }

  const rawBody = await response.text();
  try {
    return JSON.parse(rawBody);
  } catch (cause) {
    const error = new Error('Sportsnet endpoint nevrátil validné JSON dáta. Skontroluj SPORTNET_API_BASE/SPORTNET_API_URL.');
    error.status = 502;
    error.cause = cause;
    throw error;
  }
}

async function fetchSportsnetMatches({ forceRefresh = false } = {}) {
  if (!isNonEmptyString(env.sportsnetApiUrl) && !isNonEmptyString(env.sportnetApiBase)) {
    return getUnconfiguredPayload();
  }

  const now = Date.now();
  const cacheTtlSet = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;

  const shouldIgnoreCacheForRefresh = (payload) => {
    if (!payload || !Array.isArray(payload.items)) return false;

    return payload.items.some((match) => {
      if (!match.startsAt || match.status === 'finished') return false;
      const startTime = new Date(match.startsAt).getTime();
      const tenMinsAfterMatch = startTime + (115 * 60 * 1000);
      return now > tenMinsAfterMatch && (now - tenMinsAfterMatch < 15 * 60 * 1000);
    });
  };

  if (!forceRefresh && cacheState.payload && cacheState.expiresAt > now) {
    if (!shouldIgnoreCacheForRefresh(cacheState.payload)) {
      return { ...cacheState.payload, cache: 'HIT' };
    }
  }

  if (!forceRefresh) {
    const dbCached = await readCache('matches');
    if (dbCached && !shouldIgnoreCacheForRefresh(dbCached)) {
      cacheState.payload = dbCached;
      cacheState.expiresAt = now + cacheTtlSet;
      return { ...dbCached, cache: 'HIT' };
    }
  }

  const endpoint = buildSportsnetUrl();
  const allMatches = [];
  let offset = 0;
  const maxPages = 10;

  for (let page = 0; page < maxPages; page += 1) {
    const pageUrl = new URL(endpoint);
    if (offset > 0) {
      pageUrl.searchParams.set('offset', String(offset));
    }

    const payload = await fetchSportsnetJson(pageUrl.toString());
    const pageMatches = extractMatches(payload);
    allMatches.push(...pageMatches);

    const nextOffset = payload.nextOffset;
    if (!nextOffset || nextOffset <= offset || pageMatches.length === 0) {
      break;
    }
    offset = nextOffset;
  }

  const items = allMatches.map((item, index) => mapMatch(item, index));
  const normalized = {
    source: 'sportsnet.online',
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };

  cacheState.payload = normalized;
  cacheState.expiresAt = Date.now() + cacheTtlSet;

  writeCache('matches', normalized, cacheTtlSet).catch(console.error);

  return { ...normalized, cache: 'MISS' };
}

async function fetchSportsnetMatchDetail(matchId, { forceRefresh = false } = {}) {
  if (!isNonEmptyString(matchId)) {
    const error = new Error('Chýba identifikátor zápasu.');
    error.status = 400;
    throw error;
  }

  if (!isNonEmptyString(env.sportsnetApiUrl) && !isNonEmptyString(env.sportnetApiBase)) {
    return getUnconfiguredDetailPayload(matchId);
  }

  const cacheKey = String(matchId).trim();
  const now = Date.now();
  const cacheTtl = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;
  const cached = detailCacheState.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return { ...cached.payload, cache: 'HIT' };
  }

  const endpoint = buildSportsnetDetailUrl(cacheKey, { forceRefresh });
  const payload = await fetchSportsnetJson(endpoint);
  const normalized = {
    source: 'sportsnet.online',
    fetchedAt: new Date().toISOString(),
    matchId: cacheKey,
    item: mapMatch(payload, 0)
  };

  detailCacheState.set(cacheKey, {
    expiresAt: now + cacheTtl,
    payload: normalized
  });

  return { ...normalized, cache: 'MISS' };
}

module.exports = {
  fetchSportsnetMatches,
  fetchSportsnetMatchDetail
};