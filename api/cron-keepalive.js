const prisma = require('../src/data/db');
const env = require('../src/config/env');

module.exports = async (req, res) => {
    // Validate cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const ms = Date.now() - start;
        
        return res.json({ 
            status: 'ok', 
            message: 'Keepalive ping successful', 
            pingMs: ms,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Keepalive ping failed:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
};
