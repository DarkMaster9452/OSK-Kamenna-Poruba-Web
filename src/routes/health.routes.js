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

router.get('/db-details', async (req, res) => {
  try {
    const dbInfoRows = await prisma.$queryRaw`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        inet_server_addr()::text AS server_addr,
        inet_server_port() AS server_port
    `;

    const trainingCountRows = await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS training_count
      FROM "Training"
    `;

    const latestTrainingRows = await prisma.$queryRaw`
      SELECT "id", "date", "time", "category", "createdAt"
      FROM "Training"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    const dbInfo = Array.isArray(dbInfoRows) && dbInfoRows[0] ? dbInfoRows[0] : {};
    const trainingCountRaw = Array.isArray(trainingCountRows) && trainingCountRows[0]
      ? trainingCountRows[0].training_count
      : 0;
    const latestTraining = Array.isArray(latestTrainingRows) && latestTrainingRows[0]
      ? latestTrainingRows[0]
      : null;

    return res.json({
      status: 'ok',
      database: {
        name: dbInfo.database_name || null,
        user: dbInfo.database_user || null,
        serverAddr: dbInfo.server_addr || null,
        serverPort: dbInfo.server_port || null
      },
      tables: {
        Training: Number(trainingCountRaw || 0)
      },
      latestTraining,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      message: error && error.message ? error.message : 'Database detail check failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;