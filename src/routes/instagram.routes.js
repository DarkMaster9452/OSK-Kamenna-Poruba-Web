const express = require('express');
const { fetchInstagramFeed } = require('../services/instagram.service');

const router = express.Router();

router.get('/feed', async (req, res, next) => {
  try {
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const includeAll = String(req.query.all || '').toLowerCase() === 'true';
    const requestedLimit = includeAll ? 'all' : req.query.limit;
    const payload = await fetchInstagramFeed({ forceRefresh, requestedLimit });
    return res.json(payload);
  } catch (error) {
    console.error('Instagram feed route fallback:', error);
    return res.json({
      source: 'instagram.route_fallback',
      fetchedAt: new Date().toISOString(),
      count: 0,
      items: [],
      cache: 'BYPASS',
      message: 'Instagram feed sa momentalne nepodarilo nacitat.'
    });
  }
});

module.exports = router;
