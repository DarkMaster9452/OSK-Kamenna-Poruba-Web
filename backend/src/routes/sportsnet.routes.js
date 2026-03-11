const express = require('express');
const { fetchSportsnetMatches } = require('../services/sportsnet.service');

const router = express.Router();

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
