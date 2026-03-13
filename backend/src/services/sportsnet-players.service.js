const env = require('../config/env');
const { readCache, writeCache } = require('./cache');

const API_BASE = 'https://sutaze.api.sportnet.online/api/v2';
const APP_SPACE = 'osk-kamenna-poruba.futbalnet.sk';

const cacheState = {
  expiresAt: 0,
  payload: null
};

// Age-category detection from team ageCategory / displayName
const AGE_CATEGORY_MAP = {
  ADULTS: 'dospeli',
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

  const dn = String(team.displayName || '').toLowerCase();
  if (dn.includes('dospel') || dn.includes('muž')) return 'dospeli';
  if (dn.includes('u19') || dn.includes('dorast')) return 'u19';
  if (dn.includes('u17')) return 'u17';
  if (dn.includes('u15') || dn.includes('starší žiaci')) return 'u15';
  if (dn.includes('u13') || dn.includes('mladší žiaci')) return 'u13';
  if (dn.includes('u11') || dn.includes('prípravka')) return 'u11';
  if (dn.includes('u09') || dn.includes('u9')) return 'u09';
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
 * Build a date string (YYYY-MM-DD) that falls inside the team's season,
 * so the squad endpoint returns the correct roster.
 */
function getSquadDate(team) {
  if (!team.season) return new Date().toISOString().slice(0, 10);
  const from = new Date(team.season.dateFrom);
  const to = new Date(team.season.dateTo);
  const now = new Date();
  // If today is within the season, use today; otherwise use the season midpoint
  if (now >= from && now <= to) return now.toISOString().slice(0, 10);
  const mid = new Date((from.getTime() + to.getTime()) / 2);
  return mid.toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

  const appSpace = encodeURIComponent(APP_SPACE);

  // Step 1: Fetch all teams (public, no auth needed)
  let teamsPayload;
  try {
    teamsPayload = await fetchJson(`${API_BASE}/public/${appSpace}/teams?limit=200`);
  } catch (err) {
    console.error('Sportsnet public API (teams) error:', err.message);
    if (cacheState.payload) return { ...cacheState.payload, cache: 'STALE' };
    return { source: 'sportsnet-players.error', fetchedAt: new Date().toISOString(), teams: {}, cache: 'MISS', message: 'Nepodarilo sa načítať tímy zo Sportsnet.' };
  }

  const teamsList = Array.isArray(teamsPayload.teams) ? teamsPayload.teams : [];
  const bestByCategory = pickLatestTeams(teamsList);

  // Step 2: Fetch squad for each category in parallel (public, no auth needed)
  const teams = {};
  const entries = Object.entries(bestByCategory);

  await Promise.all(entries.map(async ([category, { team }]) => {
    const date = getSquadDate(team);
    const squadUrl = `${API_BASE}/public/${appSpace}/teams/${encodeURIComponent(team._id)}/squad?date=${date}`;
    let athletes = [];
    let crew = [];

    try {
      const squad = await fetchJson(squadUrl);
      athletes = Array.isArray(squad.athletes) ? squad.athletes : [];
      crew = Array.isArray(squad.crew) ? squad.crew : [];
    } catch (_) {
      // If the latest season is empty, try the previous one
      const fallback = teamsList
        .filter((t) => detectTeamCategory(t) === category && t._id !== team._id)
        .sort((a, b) => new Date(b.season?.dateFrom || 0) - new Date(a.season?.dateFrom || 0))[0];
      if (fallback) {
        try {
          const fbDate = getSquadDate(fallback);
          const fbSquad = await fetchJson(`${API_BASE}/public/${appSpace}/teams/${encodeURIComponent(fallback._id)}/squad?date=${fbDate}`);
          athletes = Array.isArray(fbSquad.athletes) ? fbSquad.athletes : [];
          crew = Array.isArray(fbSquad.crew) ? fbSquad.crew : [];
        } catch (__) { /* empty roster */ }
      }
    }

    // If latest season returned 0 athletes, try the previous season automatically
    if (athletes.length === 0) {
      const fallback = teamsList
        .filter((t) => detectTeamCategory(t) === category && t._id !== team._id)
        .sort((a, b) => new Date(b.season?.dateFrom || 0) - new Date(a.season?.dateFrom || 0))[0];
      if (fallback) {
        try {
          const fbDate = getSquadDate(fallback);
          const fbSquad = await fetchJson(`${API_BASE}/public/${appSpace}/teams/${encodeURIComponent(fallback._id)}/squad?date=${fbDate}`);
          athletes = Array.isArray(fbSquad.athletes) ? fbSquad.athletes : [];
          crew = Array.isArray(fbSquad.crew) ? fbSquad.crew : [];
        } catch (__) { /* empty roster */ }
      }
    }

    const mappedAthletes = athletes.map(mapAthlete);

    // Fetch stats for all players in parallel
    await Promise.all(mappedAthletes.map(async (player) => {
      player.stats = await fetchPlayerStats(player.sportnetId);
    }));

    const mappedCrew = crew.map((c) => ({
      sportnetId: c.sportnetUser ? c.sportnetUser._id : null,
      name: c.sportnetUser ? c.sportnetUser.name : 'Neznámy',
      position: c.additionalData?.position || 'Tréner'
    }));

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
