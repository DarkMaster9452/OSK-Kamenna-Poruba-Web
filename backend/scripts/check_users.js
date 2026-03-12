const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.groupBy({ by: ['role'], _count: { id: true } })
  .then(r => { console.log('By role:', JSON.stringify(r, null, 2)); return p.user.count(); })
  .then(total => console.log('Total users:', total))
  .finally(() => p.$disconnect());
