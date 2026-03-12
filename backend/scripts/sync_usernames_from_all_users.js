/**
 * sync_usernames_from_all_users.js
 *
 * Pre každého hráča z tabuľky all_users:
 *  - vezme Name + Surname → username = name_surname (lowercase, bez diakritiky)
 *  - nájde zodpovedajúci User účet podľa emailu
 *  - aktualizuje username
 *
 * DRY RUN štandardne — spusti s --commit pre zápis.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes('--commit');

function stripDiacritics(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd').replace(/ł/gi, 'l').replace(/ø/gi, 'o')
    .toLowerCase();
}

function buildUsername(name, surname) {
  const clean = (v) => stripDiacritics((v || '').trim()).replace(/[^a-z0-9]/g, '');
  return `${clean(name)}_${clean(surname)}`;
}

async function main() {
  console.log(`\n=== sync_usernames_from_all_users.js  [${DRY_RUN ? 'DRY RUN' : '*** COMMIT ***'}] ===\n`);

  const allUsers = await prisma.$queryRawUnsafe(`SELECT * FROM all_users ORDER BY id`);
  console.log(`all_users rows: ${allUsers.length}`);

  // Build email → User map (only players)
  const players = await prisma.user.findMany({
    where: { role: 'player' },
    select: { id: true, username: true, email: true },
  });
  const emailToUser = new Map(players.map((u) => [u.email.toLowerCase(), u]));
  console.log(`Player accounts in User: ${players.length}\n`);

  let updated = 0, skippedNoMatch = 0, skippedNoName = 0;
  const usedUsernames = new Set(players.map((u) => u.username));
  const log = [];

  for (const row of allUsers) {
    const name    = (row['Name']    || '').trim();
    const surname = (row['Surname'] || '').trim();
    if (!name && !surname) { skippedNoName++; continue; }

    // Resolve email used during migration
    const rawEmail = (row['Email'] || '').trim().toLowerCase();
    const placeholderEmail = `${stripDiacritics(name)}.${stripDiacritics(surname)}.${row.id}@offline.local`
      .replace(/[^a-z0-9.@_-]/g, '');
    const lookupEmail = rawEmail || placeholderEmail;

    const user = emailToUser.get(lookupEmail);
    if (!user) { skippedNoMatch++; continue; }

    let base = buildUsername(name, surname);
    let username = base;
    let counter = 2;
    // Deduplicate only against OTHER users (not the current one being updated)
    const takenByOther = new Set([...usedUsernames].filter((u) => u !== user.username));
    while (takenByOther.has(username)) {
      username = `${base}_${counter++}`;
    }
    // Update the set
    usedUsernames.delete(user.username);
    usedUsernames.add(username);

    log.push(`  ${user.username.padEnd(30)} → ${username}  [${name} ${surname}]`);

    if (!DRY_RUN) {
      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      });
    }
    updated++;
  }

  if (log.length <= 40) log.forEach((l) => console.log(l));
  else {
    log.slice(0, 20).forEach((l) => console.log(l));
    console.log(`  ... a ďalších ${log.length - 20}`);
  }

  console.log(`
--- Súhrn ---
  Aktualizovaných : ${updated}
  Bez zhody       : ${skippedNoMatch}
  Bez mena        : ${skippedNoName}
  Dry run         : ${DRY_RUN}
`);

  if (DRY_RUN) {
    console.log('Spusti s --commit pre zápis:');
    console.log('  node scripts/sync_usernames_from_all_users.js --commit\n');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
