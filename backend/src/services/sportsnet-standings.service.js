/**
 * Fetches live standings tables directly from the SportNet Súťaže public API v2.
 *
 * Flow per age-category team:
 *   1. GET /public/osk-kamenna-poruba.futbalnet.sk/teams
 *        → pick most-recent team per ageCategory
 *   2. GET /public/osk-kamenna-poruba.futbalnet.sk/teams/{teamId}/competitions
 *        → list active competitions (includes competition appSpace)
 *   3. GET /public/{comp.appSpace}/competitions/{compId}/parts
 *        → list groups / rounds
 *   4. GET /public/competitions/{compId}/parts/{partId}/results
 *        → standing rows (stats.matches.{played,won,lost,draw}, stats.goals.{given,received}, stats.points)
 *
 * Results are cached for env.sportsnetCacheSeconds (default 300 s).
 */

const env = require('../config/env');
const { readCache, writeCache } = require('./cache');

const SUTAZE_BASE = 'https://sutaze.api.sportnet.online/api/v2';
const APP_SPACE   = 'osk-kamenna-poruba.futbalnet.sk';

// Age categories to fetch, in display order
const AGE_CATEGORIES = ['ADULTS', 'U19', 'U17', 'U15', 'U13', 'U11', 'U09'];

// Auto-calculate current Slovak football season (July–June cycle)
function getCurrentSeason() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${String(year + 1).slice(-2)}`;
}

const standingsCache = {
  expiresAt: 0,
  payload: null
};

async function sutazeFetch(url) {
  let res;
  try {
    // Compatibility: AbortSignal.timeout is Node 17.3+, using fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
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

function extractArray(data, ...keys) {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

/**
 * Normalize one standing row.
 * Actual API shape (v2, 2025/26):
 *   row.team.name,   row.stats.matches.{played,won,lost,draw},
 *   row.stats.goals.{given,received}, row.stats.points
 */
function normalizeRow(r, idx) {
  const m = r.stats?.matches || {};
  const g = r.stats?.goals   || {};
  const s = r.stats          || {};
  return {
    rank:         idx + 1,
    teamId:       r.team?._id   || r.teamId || '',
    teamName:     r.team?.name  || r.teamName || r.name || 'Tím',
    played:       m.played      ?? s.gamesPlayed ?? s.played  ?? 0,
    won:          m.won         ?? s.wins        ?? s.won     ?? 0,
    drawn:        m.draw        ?? m.drawn       ?? s.draws   ?? s.drawn ?? 0,
    lost:         m.lost        ?? s.losses      ?? s.lost    ?? 0,
    goalsFor:     g.given       ?? s.goalsScored ?? s.goalsFor     ?? 0,
    goalsAgainst: g.received    ?? s.goalsReceived ?? s.goalsAgainst ?? 0,
    points:       s.points      ?? s.scorePoint  ?? 0
  };
}

async function fetchSportsnetStandings({ forceRefresh = false } = {}) {
  const now = Date.now();

  // 1) Fast in-memory cache (same container, same process)
  if (!forceRefresh && standingsCache.payload && standingsCache.expiresAt > now) {
    return { ...standingsCache.payload, cache: 'HIT' };
  }

  // 2) Persistent DB cache (survives serverless cold starts)
  if (!forceRefresh) {
    const dbCached = await readCache('standings');
    if (dbCached) {
      const cacheTtl = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;
      standingsCache.payload = dbCached;
      standingsCache.expiresAt = now + cacheTtl;
      return { ...dbCached, cache: 'HIT' };
    }
  }

  const currentSeason = getCurrentSeason();
  console.log(`[standings] Fetching data for season: ${currentSeason}`);

  // 1. Fetch all teams for the club (filter to current season if supported)
  let allTeams = [];
  try {
    const teamsData = await sutazeFetch(`${SUTAZE_BASE}/public/${encodeURIComponent(APP_SPACE)}/teams`);
    allTeams = extractArray(teamsData, 'teams', 'items');
  } catch (e) {
    console.warn('[standings] teams fetch failed:', e.message);
  }

  // Pick the team that best matches the current season per ageCategory.
  // Priority: team whose season name matches currentSeason > latest dateFrom
  const byCategory = new Map();
  for (const team of allTeams) {
    const cat = String(team.ageCategory || '').toUpperCase();
    if (!cat) continue;
    const seasonName = team.season?.name || team.seasonName || '';
    const isCurrentSeason = seasonName.includes(currentSeason.split('/')[0]) || seasonName === currentSeason;
    const dateFrom = team.season ? new Date(team.season.dateFrom || 0).getTime() : 0;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { team, isCurrentSeason, dateFrom });
    } else {
      const prev = byCategory.get(cat);
      // Prefer current season; if tied, prefer later dateFrom
      if (!prev.isCurrentSeason && isCurrentSeason) {
        byCategory.set(cat, { team, isCurrentSeason, dateFrom });
      } else if (prev.isCurrentSeason === isCurrentSeason && dateFrom > prev.dateFrom) {
        byCategory.set(cat, { team, isCurrentSeason, dateFrom });
      }
    }
  }

  // Unwrap to just the team object
  for (const [cat, entry] of byCategory.entries()) {
    byCategory.set(cat, entry.team);
  }

  // Order by our preferred category list
  const selectedTeams = AGE_CATEGORIES
    .filter(cat => byCategory.has(cat))
    .map(cat => byCategory.get(cat));

  const seenPartIds = new Set();
  const allGroups = [];

  for (const team of selectedTeams) {
    const teamId   = team._id || team.id;
    const teamName = team.displayName || team.name || '';
    if (!teamId) continue;

    // 2. Competitions for this team — try current-season first, fallback to all
    let competitions = [];
    try {
      const compsData = await sutazeFetch(
        `${SUTAZE_BASE}/public/${encodeURIComponent(APP_SPACE)}/teams/${encodeURIComponent(teamId)}/competitions`
      );
      const allComps = extractArray(compsData, 'competitions', 'items');
      // Filter to current season (by seasonName, dateFrom, or year in name)
      const seasonYear = currentSeason.split('/')[0];
      const currentSeasonComps = allComps.filter(c => {
        const sName = c.seasonName || c.season?.name || '';
        const sDateFrom = c.season?.dateFrom || c.dateFrom || '';
        if (sName && (sName.includes(seasonYear) || sName === currentSeason)) return true;
        if (sDateFrom && String(new Date(sDateFrom).getFullYear()) === seasonYear) return true;
        return false;
      });
      // Use current season competitions if found, otherwise fall back to all
      competitions = currentSeasonComps.length > 0 ? currentSeasonComps : allComps;
      console.log(`[standings] Team "${teamName}": ${allComps.length} total comps, ${currentSeasonComps.length} for ${currentSeason}`);
    } catch (e) {
      console.warn(`[standings] competitions fetch failed for team "${teamName}":`, e.message);
      continue;
    }

    for (const comp of competitions) {
      const compId       = comp._id || comp.id;
      const compName     = comp.name || 'Súťaž';
      const compAppSpace = comp.appSpace || APP_SPACE;
      if (!compId) continue;

      // 3. Parts (groups) of this competition
      let parts = [];
      try {
        const partsData = await sutazeFetch(
          `${SUTAZE_BASE}/public/${encodeURIComponent(compAppSpace)}/competitions/${encodeURIComponent(compId)}/parts`
        );
        parts = extractArray(partsData, 'parts', 'items');
      } catch (e) {
        console.warn(`[standings] parts fetch failed for "${compName}":`, e.message);
        continue;
      }

      for (const part of parts) {
        const partId   = part._id || part.id;
        const partName = part.name || 'Skupina';
        if (!partId || seenPartIds.has(partId)) continue;
        seenPartIds.add(partId);

        // 4. Standing rows
        try {
          const resultsData = await sutazeFetch(
            `${SUTAZE_BASE}/public/competitions/${encodeURIComponent(compId)}/parts/${encodeURIComponent(partId)}/results`
          );
          const rows = extractArray(resultsData, 'results', 'standings', 'teams', 'items');
          if (rows.length > 0) {
            allGroups.push({
              competition:   compName,
              competitionId: compId,
              part:          partName,
              partId,
              teamCategory:  team.ageCategory || null,
              results:       rows.map(normalizeRow)
            });
          }
        } catch (e) {
          console.warn(`[standings] results fetch failed for "${compName} / ${partName}":`, e.message);
        }
      }
    }
  }

  const result = {
    standings:   allGroups,
    configured:  true,
    fetchedAt:   new Date().toISOString(),
    cache:       'MISS'
  };

  const cacheTtl = Math.max(0, env.sportsnetCacheSeconds || 0) * 1000;
  standingsCache.payload  = result;
  standingsCache.expiresAt = Date.now() + cacheTtl;
  
  // Fire and forget writing to DB cache
  writeCache('standings', result, cacheTtl).catch(console.error);

  return result;
}

module.exports = { fetchSportsnetStandings };
