const express = require('express');
const { getTimelineData, getRootAssets, isConfigured, debugCloudinaryFolders, uploadImageToStream } = require('../services/cloudinary.service');
const { requireAuth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const env = require('../config/env');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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

// GET /api/cloudinary/debug — shows raw folder structure from Cloudinary API
router.get('/debug', async (req, res, next) => {
  try {
    const data = await debugCloudinaryFolders();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/cloudinary/upload — restricted to admins/coaches/bloggers
router.post('/upload', requireAuth, requireRole('admin', 'coach', 'blogger'), upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Žiadny súbor nebol nahraný.' });
    }

    const folder = req.query.folder || 'blog';
    const result = await uploadImageToStream(req.file.buffer, folder);

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
