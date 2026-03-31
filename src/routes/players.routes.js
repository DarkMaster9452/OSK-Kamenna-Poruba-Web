const express = require('express');
const { listActivePlayers } = require('../data/repository');

const router = express.Router();

function toFullName(username) {
  return String(username || '')
    .replace(/[_\.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await listActivePlayers();

    const items = rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: toFullName(row.username),
      category: row.playerCategory,
      position: '--',
      shirtNumber: row.shirtNumber ?? '--',
      dateOfBirth: '--',
      stats: {
        matches: 0,
        minutes: 0,
        goals: 0,
        yellowCards: 0,
        secondYellow: 0,
        redCards: 0
      }
    }));

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
