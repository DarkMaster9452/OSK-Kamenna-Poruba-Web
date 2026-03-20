const env = require('../config/env');
const { readCache, writeCache } = require('./cache');

const API_BASE = 'https://sutaze.api.sportnet.online/api/v2';
// Can be overridden via SPORTNET_APP_SPACE env var if the default slug is wrong
const APP_SPACE = process.env.SPORTNET_APP_SPACE || 'osk-kamenna-poruba.futbalnet.sk';

const cacheState = {
  expiresAt: 0,
  payload: null
};

// Age-category detection from team ageCategory / displayName
const AGE_CATEGORY_MAP = {
  ADULTS: 'dospeli',
  SENIORS: 'dospeli',
  SENIOR: 'dospeli',
  MEN: 'dospeli',
  A: 'dospeli',
  MUZSTVO: 'dospeli',
  MUZI: 'dospeli',
  U19: 'u19',
  U17: 'u17',
  U15: 'u15',
  U13: 'u13',
  U11: 'u11',
  U09: 'u09'
};

function detectTeamCategory(team) {
  const ac = String(team.ageCategory || '').toUpperCase().trim();
  if (AGE_CATEGORY_MAP[ac]) return AGE_CATEGORY_MAP[ac];

  const dn = String(team.displayName || team.name || '').toLowerCase();
  if (dn.includes('u09') || dn.includes('u9')) return 'u09';
  if (dn.includes('u11')) return 'u11';
  if (dn.includes('u13') || dn.includes('mladší žiaci') || dn.includes('mlad')) return 'u13';
  if (dn.includes('u15') || dn.includes('starší žiaci') || dn.includes('star')) return 'u15';
  if (dn.includes('u17')) return 'u17';
  if (dn.includes('u19') || dn.includes('dorast')) return 'u19';
  if (dn.includes('dospel') || dn.includes('muž') || dn.includes('muz') || dn.includes('senior') || dn.includes('men') || dn.includes('a-tím') || dn.includes('a tim') || dn.includes(' a ')) return 'dospeli';
  // Last-resort: if no U-age keyword in the name, assume senior/adults
  if (!dn.match(/u\d{1,2}/)) return 'dospeli';
  return null;
}

const POSITION_LABELS = {
  goalkeeper: 'Brankár',
  brankár: 'Brankár',
  brankar: 'Brankár',
  gk: 'Brankár',
  defender: 'Obranca',
  obranca: 'Obranca',
  def: 'Obranca',
  midfielder: 'Záložník',
  záložník: 'Záložník',
  zaloznik: 'Záložník',
  mid: 'Záložník',
  forward: 'Útočník',
  útočník: 'Útočník',
  utocnik: 'Útočník',
  fw: 'Útočník',
  striker: 'Útočník',
  str: 'Útočník'
};

function normalizePosition(raw) {
  if (!raw) return 'Neznáma';
  const lower = String(raw).toLowerCase().trim();
  return POSITION_LABELS[lower] || raw;
}

function mapAthlete(athlete) {
  const user = athlete.sportnetUser || {};
  const data = athlete.additionalData || {};
  return {
    sportnetId: user._id || null,
    name: user.name || 'Neznámy',
    position: normalizePosition(data.position),
    number: data.nr || null,
    captain: data.captain === true,
    age: data.age || null,
    stats: null
  };
}

async function fetchPlayerStats(sportnetId) {
  if (!sportnetId) return null;
  try {
    const data = await fetchJson(`${API_BASE}/player/${encodeURIComponent(sportnetId)}/statistics`);
    const s = data.overallStats || {};
    return {
      matches: s.match_appearances || 0,
      goals: s.goals || 0,
      minutes: s.minutes || 0,
      yellowCards: s.yellow_cards || 0,
      secondYellowCards: s.yellow_cards_second || 0,
      redCards: s.red_cards || 0
    };
  } catch (_) {
    return null;
  }
}

function groupByPosition(athletes) {
  const groups = { 'Brankár': [], 'Obranca': [], 'Záložník': [], 'Útočník': [], 'Neznáma': [] };
  athletes.forEach((p) => {
    (groups[p.position] || groups['Neznáma']).push(p);
  });
  return groups;
}

/**
 * Pick the best (most recent) team for each age category.
 * Prefers the current or latest season that actually has data.
 */
function pickLatestTeams(teamsList) {
  const best = {};
  for (const t of teamsList) {
    const cat = detectTeamCategory(t);
    if (!cat) continue;
    const seasonFrom = t.season ? new Date(t.season.dateFrom || 0).getTime() : 0;
    if (!best[cat] || seasonFrom > best[cat].seasonFrom) {
      best[cat] = { team: t, seasonFrom };
    }
  }
  return best;
}

/**
 * Build a date string (YYYY-MM-DD) for the squad endpoint.
 * Always use today's date so the API returns the current season's roster.
 */
function getSquadDate() {
  return new Date().toISOString().slice(0, 10);
}

function getApiKey() {
  const raw = String(env.sportsnetApiKey || '').trim().replace(/^(ApiKey|Bearer)\s+/i, '').trim();
  return raw || null;
}

function authHeaders() {
  const key = getApiKey();
  const headers = { Accept: 'application/json' };
  if (key) headers.Authorization = `ApiKey ${key}`;
  return headers;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Extract a flat array of teams from whatever the API returns.
 * Handles: { teams: [...] }, { items: [...] }, or a raw array.
 */
function extractTeamsList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload && payload.teams)) return payload.teams;
  if (Array.isArray(payload && payload.items)) return payload.items;
  return [];
}

/**
 * Try to fetch the teams list via the authenticated org API first (same as
 * the working matches API), then fall back to the public sutaze API.
 */
async function fetchTeamsList() {
  const orgId = String(env.sportnetOrgId || '').trim();
  const apiBase = String(env.sportnetApiBase || '').replace(/\/+$/, '');

  // Primary: authenticated org API (mirrors what the matches service uses)
  if (orgId && apiBase) {
    const url = `${apiBase}/organizations/${encodeURIComponent(orgId)}/teams?limit=200`;
    try {
      const payload = await fetchJson(url, authHeaders());
      const list = extractTeamsList(payload);
      if (list.length > 0) {
        console.log(`[players] org API returned ${list.length} teams`);
        return { list, squadBase: `${apiBase}/organizations/${encodeURIComponent(orgId)}/teams`, authRequired: true };
      }
      console.warn('[players] org API returned 0 teams, falling back to public API');
    } catch (err) {
      console.warn('[players] org API teams error:', err.message, '— falling back to public API');
    }
  }

  // Fallback: public sutaze API
  const appSpace = encodeURIComponent(APP_SPACE);
  const url = `${API_BASE}/public/${appSpace}/teams?limit=200`;
  const payload = await fetchJson(url); // throws if it fails — handled by caller
  const list = extractTeamsList(payload);
  console.log(`[players] public API returned ${list.length} teams for appSpace=${APP_SPACE}`);
  return { list, squadBase: `${API_BASE}/public/${appSpace}/teams`, authRequired: false };
}

async function fetchSportsnetPlayers({ forceRefresh = false } = {}) {
  const now = Date.now();

  // 1) Fast in-memory cache (same container, same process)
  if (!forceRefresh && cacheState.payload && cacheState.expiresAt > now) {
    return { ...cacheState.payload, cache: 'HIT' };
  }

  // 2) Persistent DB cache (survives serverless cold starts)
  if (!forceRefresh) {
    const dbCached = await readCache('players');
    if (dbCached) {
      const cacheTtl = Math.max(0, env.sportnetPlayersCacheSeconds || 0) * 1000;
      cacheState.payload = dbCached;
      cacheState.expiresAt = now + cacheTtl;
      return { ...dbCached, cache: 'HIT' };
    }
  }

  // Step 1: Fetch all teams
  let teamsResult;
  try {
    teamsResult = await fetchTeamsList();
  } catch (err) {
    console.error('[players] teams fetch failed:', err.message);
    if (cacheState.payload) return { ...cacheState.payload, cache: 'STALE' };
    return { source: 'sportsnet-players.error', fetchedAt: new Date().toISOString(), teams: {}, cache: 'MISS', message: 'Nepodarilo sa načítať tímy zo Sportsnet.' };
  }

  const { list: teamsList, squadBase, authRequired } = teamsResult;
  console.log(`[players] fetched ${teamsList.length} teams from SportNet. ageCats:`, teamsList.map(t => `${t.displayName || t.name}(${t.ageCategory})`).join(', '));
  const bestByCategory = pickLatestTeams(teamsList);

  // Step 2: Fetch squad for each category in parallel
  const teams = {};
  const entries = Object.entries(bestByCategory);
  const hdrs = authRequired ? authHeaders() : {};

  await Promise.all(entries.map(async ([category, { team }]) => {
    const date = getSquadDate();
    const squadUrlDate = `${squadBase}/${encodeURIComponent(team._id)}/squad?date=${date}`;
    const squadUrlNoDate = `${squadBase}/${encodeURIComponent(team._id)}/squad`;
    let athletes = [];
    let crew = [];

    try {
      const squad = await fetchJson(squadUrlDate, hdrs);
      athletes = Array.isArray(squad.athletes) ? squad.athletes : [];
      crew = Array.isArray(squad.crew) ? squad.crew : [];
    } catch (err) {
      console.warn(`[players] squad (with date) failed for ${category} (${team._id}):`, err.message);
    }

    // Retry without date if no athletes returned
    if (athletes.length === 0) {
      try {
        const squad = await fetchJson(squadUrlNoDate, hdrs);
        const fallback = Array.isArray(squad.athletes) ? squad.athletes : [];
        if (fallback.length > 0) {
          athletes = fallback;
          crew = Array.isArray(squad.crew) ? squad.crew : crew;
        }
      } catch (err) {
        console.warn(`[players] squad (no date) failed for ${category} (${team._id}):`, err.message);
      }
    }
    console.log(`[players] ${category}: ${athletes.length} athletes`);

    const mappedAthletes = athletes.map(mapAthlete);

    // Fetch stats for all players in parallel
    await Promise.all(mappedAthletes.map(async (player) => {
      player.stats = await fetchPlayerStats(player.sportnetId);
    }));

    const mappedCrew = crew.map((c) => {
      let name = c.sportnetUser ? c.sportnetUser.name : 'Neznámy';
      
      // Override for A-team Realizačný tím
      if (category === 'dospeli' && (name.includes('Strhár') || name.includes('Strhar'))) {
        name = 'Juraj Ihnatišin';
      }

      return {
        sportnetId: c.sportnetUser ? c.sportnetUser._id : null,
        name: name,
        position: c.additionalData?.position || 'Tréner'
      };
    });

    teams[category] = {
      teamId: team._id,
      name: team.displayName || team.name,
      players: mappedAthletes,
      playersByPosition: groupByPosition(mappedAthletes),
      crew: mappedCrew,
      count: mappedAthletes.length
    };
  }));

  const normalized = {
    source: 'sportsnet-players.online',
    fetchedAt: new Date().toISOString(),
    teams
  };

  const cacheTtl = Math.max(0, env.sportnetPlayersCacheSeconds || 0) * 1000;
  cacheState.payload = normalized;
  cacheState.expiresAt = Date.now() + cacheTtl;

  // Fire and forget writing to DB cache
  writeCache('players', normalized, cacheTtl).catch(console.error);

  return { ...normalized, cache: 'MISS' };
}

module.exports = {
  fetchSportsnetPlayers
};
