require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { fetchSportsnetPlayers } = require('../src/services/sportsnet-players.service');

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--commit');
const TARGET_CATEGORIES = ['dospeli', 'u19', 'u17', 'u15', 'u13', 'u11', 'u09'];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeNameKey(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

async function main() {
  console.log(`\n=== sync_active_players_from_squads.js [${DRY_RUN ? 'DRY RUN' : 'COMMIT'}] ===\n`);

  const payload = await fetchSportsnetPlayers({ forceRefresh: true });
  const activeNames = new Set();

  for (const category of TARGET_CATEGORIES) {
    const team = payload.teams?.[category];
    const players = Array.isArray(team?.players) ? team.players : [];
    players.forEach((player) => {
      if (player?.name) activeNames.add(normalizeNameKey(player.name));
    });
  }

  const activeNameList = [...activeNames];
  console.log(`Roster names found: ${activeNameList.length}`);

  const players = await prisma.user.findMany({
    where: { role: 'player' },
    select: { id: true, username: true, email: true, isActive: true }
  });

  const byKey = new Map();
  for (const user of players) {
    const key = normalizeNameKey(user.username.replace(/[._]+/g, ' '));
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(user);
  }

  const toActivateIds = new Set();
  const unmatchedRoster = [];
  const ambiguousRoster = [];

  for (const rosterName of activeNameList) {
    const matched = byKey.get(rosterName) || [];
    if (matched.length === 1) {
      toActivateIds.add(matched[0].id);
    } else if (matched.length > 1) {
      ambiguousRoster.push({ rosterName, matches: matched.map((m) => m.username) });
    } else {
      unmatchedRoster.push(rosterName);
    }
  }

  const activate = players.filter((u) => toActivateIds.has(u.id));
  const deactivate = players.filter((u) => !toActivateIds.has(u.id));

  console.log(`Matched active users: ${activate.length}`);
  console.log(`Players to deactivate: ${deactivate.length}`);
  console.log(`Unmatched roster names: ${unmatchedRoster.length}`);
  console.log(`Ambiguous roster names: ${ambiguousRoster.length}`);

  if (unmatchedRoster.length) {
    console.log('\nUnmatched roster names (first 30):');
    unmatchedRoster.slice(0, 30).forEach((name) => console.log(`  - ${name}`));
  }

  if (ambiguousRoster.length) {
    console.log('\nAmbiguous roster names:');
    ambiguousRoster.slice(0, 20).forEach((item) => console.log(`  - ${item.rosterName}: ${item.matches.join(', ')}`));
  }

  if (!DRY_RUN) {
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { role: 'player', id: { in: [...toActivateIds] } },
        data: { isActive: true }
      }),
      prisma.user.updateMany({
        where: { role: 'player', id: { notIn: [...toActivateIds] } },
        data: { isActive: false }
      })
    ]);
    console.log('\nActivation sync applied.');
  } else {
    console.log('\nRun with --commit to apply changes.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
