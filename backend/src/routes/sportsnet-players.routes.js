const express = require('express');
const { fetchSportsnetPlayers } = require('../services/sportsnet-players.service');

const router = express.Router();

router.get('/players', async (req, res, next) => {
  try {
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const teamFilter = req.query.team ? String(req.query.team).trim().toLowerCase() : null;
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
