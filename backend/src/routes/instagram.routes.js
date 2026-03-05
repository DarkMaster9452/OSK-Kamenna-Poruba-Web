const express = require('express');
const { fetchInstagramFeed } = require('../services/instagram.service');

const router = express.Router();

router.get('/feed', async (req, res, next) => {
  try {
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const payload = await fetchInstagramFeed({ forceRefresh });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
