const express = require('express');
const { getTimelineData, getRootAssets, isConfigured } = require('../services/cloudinary.service');
const env = require('../config/env');

const router = express.Router();

// GET /api/cloudinary/config — public cloud name (not secret)
router.get('/config', (req, res) => {
  res.json({
    configured: isConfigured(),
    cloudName: env.cloudinaryCloudName || null
  });
});

// GET /api/cloudinary/timeline — all folders with their images
router.get('/timeline', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const data = await getTimelineData({ forceRefresh });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/cloudinary/assets — root-level images (logos, illustrations, etc.)
router.get('/assets', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const data = await getRootAssets({ forceRefresh });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
