/**
 * Fetches live standings tables directly from the SportNet Súťaže public API v2.
 * Flow:
 *   1. GET /public/{orgId}/teams/{teamId}/competitions  → list of competitions
 *   2. GET /public/{orgId}/competitions/{compId}/parts  → list of parts (groups)
 *   3. GET /public/competitions/{compId}/parts/{partId}/results → standing rows
 *
 * Results are cached for env.sportsnetCacheSeconds (default 300 s).
 */

const env = require('../config/env');

const SUTAZE_BASE = (
  process.env.SPORTNET_SUTAZE_API_BASE || 'https://sutaze.api.sportnet.online/api/v2'
).replace(/\/+$/, '');

const standingsCache = {
  expiresAt: 0,
  payload: null
};

function isConfigured() {
  return (
    typeof env.sportnetOrgId === 'string' && env.sportnetOrgId.trim().length > 0 &&
    typeof env.sportsnetTeamId === 'string' && env.sportsnetTeamId.trim().length > 0
  );
}

async function sutazeFetch(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
  } catch (cause) {
    const e = new Error(`Sutaze API connection failed: ${url}`);
    e.status = 502;
    e.cause = cause;
    throw e;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const e = new Error(`Sutaze API HTTP ${res.status}: ${url} — ${body.slice(0, 200)}`);
    e.status = 502;
    throw e;
  }

  return res.json();
}

/** Try a list of known keys to find an array in the response */
function extractArray(data, ...keys) {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

/** Normalize one standing row from any SportNet v2 shape */
function normalizeRow(r, idx) {
  // stats can be nested under r.stats or flat on r itself
  const s = r.stats || r;
  return {
    rank: r.rank ?? idx + 1,
    teamId: r.team?._id || r.team?.id || r.teamId || '',
    teamName: r.team?.name || r.teamName || r.name || 'Tím',
    played: s.gamesPlayed ?? s.played ?? 0,
    won: s.wins ?? s.won ?? 0,
    drawn: s.draws ?? s.drawn ?? s.ties ?? 0,
    lost: s.losses ?? s.lost ?? 0,
    goalsFor: s.goalsScored ?? s.goalsFor ?? s.goals ?? 0,
    goalsAgainst: s.goalsReceived ?? s.goalsAgainst ?? 0,
    points: s.points ?? s.scorePoint ?? 0
  };
}

async function fetchSportsnetStandings({ forceRefresh = false } = {}) {
  if (!isConfigured()) {
    return {
      standings: [],
      configured: false,
      fetchedAt: new Date().toISOString(),
      message: 'SPORTNET_ORG_ID alebo SPORTSNET_TEAM_ID nie je nastavené.'
    };
  }

  const now = Date.now();
  if (!forceRefresh && standingsCache.payload && standingsCache.expiresAt > now) {
    return { ...standingsCache.payload, cache: 'HIT' };
  }

  const orgId = env.sportnetOrgId.trim();
  const teamId = env.sportsnetTeamId.trim();

  // 1. Competitions this team participates in
  const compsUrl = `${SUTAZE_BASE}/public/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(teamId)}/competitions`;
  let competitions;
  try {
    const compsData = await sutazeFetch(compsUrl);
    competitions = extractArray(compsData, 'competitions', 'items', 'results');
  } catch (e) {
    throw e;
  }

  const allGroups = [];

  for (const comp of competitions) {
    const compId = comp._id || comp.id || comp.competitionId;
    const compName = comp.name || 'Súťaž';
    if (!compId) continue;

    // 2. Parts (groups/rounds) of this competition
    let parts = [];
    try {
      const partsUrl = `${SUTAZE_BASE}/public/${encodeURIComponent(orgId)}/competitions/${encodeURIComponent(compId)}/parts`;
      const partsData = await sutazeFetch(partsUrl);
      parts = extractArray(partsData, 'parts', 'items');
    } catch (e) {
      console.warn(`[standings] parts fetch failed for "${compName}":`, e.message);
      continue;
    }

    for (const part of parts) {
      const partId = part._id || part.id || part.partId;
      const partName = part.name || 'Skupina';
      if (!partId) continue;

      // 3. Standing rows for this part
      try {
        const resultsUrl = `${SUTAZE_BASE}/public/competitions/${encodeURIComponent(compId)}/parts/${encodeURIComponent(partId)}/results`;
        const resultsData = await sutazeFetch(resultsUrl);
        const rows = extractArray(resultsData, 'results', 'standings', 'teams', 'items');

        if (rows.length > 0) {
          allGroups.push({
            competition: compName,
            competitionId: compId,
            part: partName,
            partId,
            results: rows.map(normalizeRow)
          });
        }
      } catch (e) {
        console.warn(`[standings] results fetch failed for "${compName} / ${partName}":`, e.message);
      }
    }
  }

  const result = {
    standings: allGroups,
    configured: true,
    fetchedAt: new Date().toISOString(),
    cache: 'MISS'
  };

  const cacheTtl = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;
  standingsCache.payload = result;
  standingsCache.expiresAt = now + cacheTtl;

  return result;
}

module.exports = { fetchSportsnetStandings };
