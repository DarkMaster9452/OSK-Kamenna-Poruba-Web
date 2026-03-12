/**
 * migrate_all_users.js
 *
 * Migrates rows from the "all_users" table into the "User" (Prisma) table.
 *
 * Rules:
 *  - Role: player
 *  - Default password: Poruba2026!   (user should change after first login)
 *  - username: firstname.surname (lowercase, diacritics stripped, deduplicated with _2, _3 ...)
 *  - email: from all_users.Email; if empty → firstname.surname.<id>@offline.local (placeholder)
 *  - Skips rows that already have a matching username OR email in User table
 *  - DRY RUN by default — pass --commit to actually write to DB
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createId } = require('@paralleldrive/cuid2');

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--commit');
const DEFAULT_PASSWORD = 'Poruba2026!';

// Slovak / Czech diacritic → ASCII map
function stripDiacritics(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining marks
    .replace(/đ/gi, 'd')
    .replace(/ł/gi, 'l')
    .replace(/ø/gi, 'o')
    .replace(/ß/gi, 'ss')
    .toLowerCase();
}

function toUsername(name, surname) {
  const n = stripDiacritics((name || '').trim());
  const s = stripDiacritics((surname || '').trim());
  // keep only letters, digits, dots, underscores
  const clean = (v) => v.replace(/[^a-z0-9]/g, '');
  return `${clean(n)}.${clean(s)}`;
}

async function main() {
  console.log(`\n=== migrate_all_users.js  [${DRY_RUN ? 'DRY RUN — no changes written' : '*** COMMIT MODE ***'}] ===\n`);

  // 1. Fetch source rows
  const allUsers = await prisma.$queryRawUnsafe(`SELECT * FROM all_users ORDER BY id`);
  console.log(`Source rows in all_users: ${allUsers.length}`);

  // 2. Load existing User usernames & emails for collision detection
  const existingUsers = await prisma.user.findMany({ select: { username: true, email: true } });
  const existingUsernames = new Set(existingUsers.map((u) => u.username));
  const existingEmails    = new Set(existingUsers.map((u) => u.email.toLowerCase()));
  console.log(`Existing User accounts: ${existingUsers.length}\n`);

  // 3. Pre-hash the shared default password once
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0, skippedNoName = 0, skippedDuplicate = 0;
  const skippedDuplicateList = [];
  const createdList = [];

  // Track usernames we're about to insert so we can deduplicate within this run
  const usedUsernames = new Set(existingUsernames);
  const usedEmails    = new Set(existingEmails);

  for (const row of allUsers) {
    const name    = (row['Name']    || '').trim();
    const surname = (row['Surname'] || '').trim();
    const email   = (row['Email']   || '').trim().toLowerCase();

    // Skip rows with no usable name
    if (!name && !surname) {
      skippedNoName++;
      continue;
    }

    // Resolve email — placeholder if missing
    const resolvedEmail = email || `${stripDiacritics(name)}.${stripDiacritics(surname)}.${row.id}@offline.local`
      .replace(/[^a-z0-9.@_-]/g, '');

    // Check email collision
    if (usedEmails.has(resolvedEmail)) {
      skippedDuplicate++;
      skippedDuplicateList.push(`  SKIP (email exists): ${name} ${surname} <${resolvedEmail}>`);
      continue;
    }

    // Build unique username
    let baseUsername = toUsername(name, surname);
    if (!baseUsername.replace('.', '').trim()) {
      skippedNoName++;
      continue;
    }
    let username = baseUsername;
    let counter = 2;
    while (usedUsernames.has(username)) {
      username = `${baseUsername}_${counter++}`;
    }

    usedUsernames.add(username);
    usedEmails.add(resolvedEmail);

    const userData = {
      id:           createId(),
      username,
      email:        resolvedEmail,
      role:         'player',
      passwordHash,
      isActive:     true,
      createdAt:    new Date(),
    };

    createdList.push(`  + ${username}  <${resolvedEmail}>  [${name} ${surname}]`);

    if (!DRY_RUN) {
      await prisma.user.create({ data: userData });
    }
    created++;
  }

  // Summary
  console.log('--- Results ---');
  if (createdList.length <= 50) {
    createdList.forEach((l) => console.log(l));
  } else {
    createdList.slice(0, 20).forEach((l) => console.log(l));
    console.log(`  ... and ${createdList.length - 20} more`);
  }
  if (skippedDuplicateList.length) {
    console.log('\nSkipped duplicates:');
    skippedDuplicateList.forEach((l) => console.log(l));
  }

  console.log(`
--- Summary ---
  Would create / created : ${created}
  Skipped (no name)      : ${skippedNoName}
  Skipped (duplicate)    : ${skippedDuplicate}
  Default password       : ${DEFAULT_PASSWORD}
  Dry run                : ${DRY_RUN}
`);

  if (DRY_RUN) {
    console.log('Run with --commit to apply changes:');
    console.log('  node scripts/migrate_all_users.js --commit\n');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
