require('dotenv').config({ path: __dirname + '/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.cache.deleteMany({ where: { key: 'players' } });
    console.log('Cache cleared from DB.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
