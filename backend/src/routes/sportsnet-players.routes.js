const express = require('express');
const { fetchSportsnetPlayers } = require('../services/sportsnet-players.service');
const { invalidateCache } = require('../services/cache');

const router = express.Router();

// Raw debug endpoint – shows exactly what SportNet API returns for teams + squads.
// Hit /api/sportsnet/players/debug in a browser to diagnose missing players.
router.get('/players/debug', async (req, res) => {
  const APP_SPACE = process.env.SPORTNET_APP_SPACE || 'osk-kamenna-poruba.futbalnet.sk';
  const API_BASE = 'https://sutaze.api.sportnet.online/api/v2';
  const appSpace = encodeURIComponent(APP_SPACE);
  const today = new Date().toISOString().slice(0, 10);
  const orgId = process.env.SPORTNET_ORG_ID || process.env.SPORTSNET_ORG_ID || '';
  const apiBase = (process.env.SPORTNET_API_BASE || '').replace(/\/+$/, '');
  const apiKey = (process.env.SPORTNET_API_KEY || process.env.SPORTSNET_API_KEY || '').replace(/^(ApiKey|Bearer)\s+/i, '').trim();
  const authHdrs = apiKey ? { Accept: 'application/json', Authorization: `ApiKey ${apiKey}` } : { Accept: 'application/json' };

  const out = { appSpace: APP_SPACE, orgId, apiBase: apiBase || '(not set)', hasApiKey: !!apiKey, today, teams: [], errors: [] };

  // Try authenticated org API first
  let teamsData;
  if (orgId && apiBase) {
    try {
      const r = await fetch(`${apiBase}/organizations/${encodeURIComponent(orgId)}/teams?limit=200`, { headers: authHdrs });
      const body = await r.text();
      out.orgApiStatus = r.status;
      if (r.ok) { teamsData = JSON.parse(body); out.orgApiTeamsCount = (teamsData.teams || teamsData.items || teamsData || []).length; }
      else { out.errors.push(`org API teams HTTP ${r.status}: ${body.slice(0, 200)}`); }
    } catch (e) { out.errors.push(`org API fetch error: ${e.message}`); }
  }

  // Fallback: public sutaze API
  let publicTeamsData;
  try {
    const r = await fetch(`${API_BASE}/public/${appSpace}/teams?limit=200`, { headers: { Accept: 'application/json' } });
    const body = await r.text();
    out.publicApiStatus = r.status;
    if (r.ok) { publicTeamsData = JSON.parse(body); out.publicApiTeamsCount = (publicTeamsData.teams || publicTeamsData.items || []).length; }
    else { out.errors.push(`public API teams HTTP ${r.status}: ${body.slice(0, 200)}`); }
  } catch (e) { out.errors.push(`public API fetch error: ${e.message}`); }

  // Use whichever returned teams
  const resolvedData = teamsData || publicTeamsData;
  if (!resolvedData) return res.json(out);

  const teamsList = Array.isArray(resolvedData) ? resolvedData : (resolvedData.teams || resolvedData.items || []);
  await Promise.all(teamsList.map(async (team) => {
    const entry = {
      id: team._id,
      name: team.displayName || team.name,
      ageCategory: team.ageCategory,
      season: team.season,
      rawKeys: Object.keys(team)
    };
    // Build squad URL (prefer org API if available and returned this team)
    const squadBase = (teamsData && orgId && apiBase)
      ? `${apiBase}/organizations/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(team._id)}/squad`
      : `${API_BASE}/public/${appSpace}/teams/${encodeURIComponent(team._id)}/squad`;
    const hdrs = (teamsData && apiKey) ? authHdrs : { Accept: 'application/json' };
    // Try with date
    try {
      const r = await fetch(`${squadBase}?date=${today}`, { headers: hdrs });
      const body = await r.text();
      entry.squadWithDateStatus = r.status;
      if (r.ok) { const d = JSON.parse(body); entry.squadWithDateAthletes = (d.athletes || []).length; }
      else { entry.squadWithDateBody = body.slice(0, 200); }
    } catch (e) { entry.squadWithDateError = e.message; }
    // Try without date
    try {
      const r = await fetch(squadBase, { headers: hdrs });
      const body = await r.text();
      entry.squadNodateStatus = r.status;
      if (r.ok) { const d = JSON.parse(body); entry.squadNodateAthletes = (d.athletes || []).length; }
      else { entry.squadNodateBody = body.slice(0, 200); }
    } catch (e) { entry.squadNodateError = e.message; }
    out.teams.push(entry);
  }));

  return res.json(out);
});

router.get('/players', async (req, res, next) => {
  try {
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const teamFilter = req.query.team ? String(req.query.team).trim().toLowerCase() : null;
    // When forcing refresh, also wipe the persistent DB cache so stale empty data doesn't get served
    if (forceRefresh) await invalidateCache('players').catch(() => {});
    const payload = await fetchSportsnetPlayers({ forceRefresh });

    if (teamFilter && payload.teams) {
      const filteredTeams = {};
      teamFilter.split(',').forEach((key) => {
        const k = key.trim();
        if (payload.teams[k]) {
          filteredTeams[k] = payload.teams[k];
        }
      });

      return res.json({
        ...payload,
        teams: filteredTeams
      });
    }

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
