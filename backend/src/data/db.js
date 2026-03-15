const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

// For Vercel Serverless, append connection_limit to URL if not present
let dbUrl = process.env.DATABASE_URL;
if (dbUrl && !dbUrl.includes('connection_limit=')) {
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${separator}connection_limit=3&pool_timeout=15`;
}

if (!globalForPrisma.__oskPrisma) {
  globalForPrisma.__oskPrisma = new PrismaClient({
    datasourceUrl: dbUrl
  });
}

const prisma = globalForPrisma.__oskPrisma;

module.exports = prisma;