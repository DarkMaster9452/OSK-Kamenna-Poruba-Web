const app = require('../src/app');
const prisma = require('../src/data/db');

// Vercel Cold Start Optimization:
// Fire a background ping immediately when the serverless function module is evaluated.
// By the time the actual HTTP request hits the Express router, the DB connection
// is already established (or in progress), saving ~1000-2000ms.
try {
    prisma.$queryRaw`SELECT 1`.catch(() => {});
} catch (err) {}

module.exports = app;
