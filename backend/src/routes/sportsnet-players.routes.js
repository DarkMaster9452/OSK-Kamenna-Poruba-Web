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

  const out = { appSpace: APP_SPACE, today, teams: [], errors: [] };

  let teamsData;
  try {
    const r = await fetch(`${API_BASE}/public/${appSpace}/teams?limit=200`, { headers: { Accept: 'application/json' } });
    const body = await r.text();
    out.teamsStatus = r.status;
    if (!r.ok) { out.errors.push(`teams HTTP ${r.status}: ${body.slice(0, 300)}`); return res.json(out); }
    teamsData = JSON.parse(body);
    out.teamsCount = Array.isArray(teamsData.teams) ? teamsData.teams.length : 0;
  } catch (e) {
    out.errors.push(`teams fetch error: ${e.message}`);
    return res.json(out);
  }

  const teamsList = Array.isArray(teamsData.teams) ? teamsData.teams : [];
  await Promise.all(teamsList.map(async (team) => {
    const entry = {
      id: team._id,
      name: team.displayName || team.name,
      ageCategory: team.ageCategory,
      season: team.season,
      rawKeys: Object.keys(team)
    };
    // Try with date
    try {
      const r = await fetch(`${API_BASE}/public/${appSpace}/teams/${encodeURIComponent(team._id)}/squad?date=${today}`, { headers: { Accept: 'application/json' } });
      const body = await r.text();
      entry.squadWithDateStatus = r.status;
      if (r.ok) { const d = JSON.parse(body); entry.squadWithDateAthletes = (d.athletes || []).length; }
    } catch (e) { entry.squadWithDateError = e.message; }
    // Try without date
    try {
      const r = await fetch(`${API_BASE}/public/${appSpace}/teams/${encodeURIComponent(team._id)}/squad`, { headers: { Accept: 'application/json' } });
      const body = await r.text();
      entry.squadNodateStatus = r.status;
      if (r.ok) { const d = JSON.parse(body); entry.squadNodateAthletes = (d.athletes || []).length; }
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
