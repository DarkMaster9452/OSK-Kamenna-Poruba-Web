const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'all_users'
    ORDER BY ordinal_position
  `);
  console.log('Columns:', JSON.stringify(cols, null, 2));

  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM all_users LIMIT 5`);
  console.log('Sample rows:', JSON.stringify(rows, null, 2));

  const cnt = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM all_users`);
  console.log('Total rows:', JSON.stringify(cnt));
}

main().catch(console.error).finally(() => prisma.$disconnect());
