const express = require('express');
const { fetchSportsnetMatches } = require('../services/sportsnet.service');

const router = express.Router();

router.get('/matches', async (req, res, next) => {
  try {
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const payload = await fetchSportsnetMatches({ forceRefresh });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
