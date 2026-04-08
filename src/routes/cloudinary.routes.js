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

function applyPublicCacheHeaders(res, forceRefresh) {
  if (forceRefresh) {
    res.set('Cache-Control', 'no-store');
    return;
  }

  const browserTtl = 60 * 60;
  const edgeTtl = Math.max(browserTtl, Number(env.cloudinaryCacheSeconds || 172800));
  res.set('Cache-Control', `public, max-age=${browserTtl}, s-maxage=${edgeTtl}, stale-while-revalidate=604800`);
}

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
    applyPublicCacheHeaders(res, forceRefresh);
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
    applyPublicCacheHeaders(res, forceRefresh);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/cloudinary/debug — shows raw folder structure from Cloudinary API
router.get('/debug', requireAuth, requireRole('admin'), async (req, res, next) => {
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
