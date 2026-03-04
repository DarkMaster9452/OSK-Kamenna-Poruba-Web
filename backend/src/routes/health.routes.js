const express = require('express');
const prisma = require('../data/db');

const router = express.Router();

router.get('/', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

router.get('/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: error && error.message ? error.message : 'Database check failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;