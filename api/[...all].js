let app;
try {
    app = require('../src/app');
} catch (err) {
    console.error('Failed to load app:', err);
    app = require('express')();
    app.get('/api/csrf-token', (_req, res) => res.json({ csrfToken: '' }));
    app.get('/csrf-token', (_req, res) => res.json({ csrfToken: '' }));
    app.get('*', (_req, res) => res.status(500).json({ error: 'Server initialization failed' }));
}

try {
    const prisma = require('../src/data/db');
    prisma.$queryRaw`SELECT 1`.catch(() => {});
} catch (err) {
    console.warn('Prisma initialization skipped:', err.message);
}

module.exports = app;
