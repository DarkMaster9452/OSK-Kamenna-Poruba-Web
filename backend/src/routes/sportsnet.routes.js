const express = require('express');
const { fetchSportsnetMatches } = require('../services/sportsnet.service');

const router = express.Router();

function computeStandingsFromMatches(items) {
  const competitionMap = {};

  items
    .filter(m => {
      const s = String(m.status || '').toLowerCase();
      return s.includes('finish') || s.includes('ended') || s.includes('completed');
    })
    .forEach(m => {
      const comp = m.competition || 'Neznáma súťaž';
      if (!competitionMap[comp]) competitionMap[comp] = {};
      const table = competitionMap[comp];

      const addTeam = (name) => {
        if (!table[name]) {
          table[name] = { name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
        }
      };

      addTeam(m.homeTeam);
      addTeam(m.awayTeam);

      const hg = Number(m.scoreHome ?? 0);
      const ag = Number(m.scoreAway ?? 0);

      table[m.homeTeam].played++;
      table[m.homeTeam].goalsFor += hg;
      table[m.homeTeam].goalsAgainst += ag;

      table[m.awayTeam].played++;
      table[m.awayTeam].goalsFor += ag;
      table[m.awayTeam].goalsAgainst += hg;

      if (hg > ag) {
        table[m.homeTeam].won++;    table[m.homeTeam].points += 3;
        table[m.awayTeam].lost++;
      } else if (hg < ag) {
        table[m.awayTeam].won++;    table[m.awayTeam].points += 3;
        table[m.homeTeam].lost++;
      } else {
        table[m.homeTeam].drawn++;  table[m.homeTeam].points += 1;
        table[m.awayTeam].drawn++;  table[m.awayTeam].points += 1;
      }
    });

  const standings = {};
  Object.entries(competitionMap).forEach(([comp, teamsObj]) => {
    const teams = Object.values(teamsObj);
    teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = a.goalsFor - a.goalsAgainst;
      const bDiff = b.goalsFor - b.goalsAgainst;
      if (bDiff !== aDiff) return bDiff - aDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name, 'sk');
    });
    standings[comp] = teams;
  });

  return standings;
}

router.get('/standings', async (req, res, next) => {
  try {
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const payload = await fetchSportsnetMatches({ forceRefresh });

    if (payload.source === 'sportsnet.unconfigured') {
      return res.json({ standings: {}, fetchedAt: payload.fetchedAt, cache: 'BYPASS', source: payload.source });
    }

    const standings = computeStandingsFromMatches(Array.isArray(payload.items) ? payload.items : []);
    return res.json({
      standings,
      fetchedAt: payload.fetchedAt,
      cache: payload.cache,
      source: payload.source,
      matchCount: Array.isArray(payload.items) ? payload.items.length : 0
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/matches', async (req, res, next) => {
  try {
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const upcomingLimit = parseInt(req.query.upcoming, 10);
    const payload = await fetchSportsnetMatches({ forceRefresh });

    if (!isNaN(upcomingLimit) && upcomingLimit > 0 && Array.isArray(payload.items)) {
      const now = new Date();
      const upcoming = payload.items
        .filter(m => {
          const s = String(m.status || '').toLowerCase();
          if (s.includes('finish') || s.includes('ended') || s.includes('completed')) return false;
          if (m.startsAt && new Date(m.startsAt) < now && s !== 'live') return false;
          return true;
        })
        .sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0))
        .slice(0, upcomingLimit);

      return res.json({
        ...payload,
        count: upcoming.length,
        items: upcoming
      });
    }

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
