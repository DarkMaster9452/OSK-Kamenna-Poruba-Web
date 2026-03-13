/**
 * Vercel Cron endpoint – pre-fetches all SportNet data every 4 hours.
 *
 * Scheduled in vercel.json:  "schedule": "0 */4 * * *"
 *
 * This ensures the file cache is always warm so visitors never have to wait
 * for a live SportNet API call.
 *
 * Security: pass the CRON_SECRET env var in Vercel. Vercel automatically sends
 * it in the Authorization header when triggering cron jobs. You can also call
 * the URL manually:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://…/api/cron-sportnet
 */

const { fetchSportsnetMatches } = require('../src/services/sportsnet.service');
const { fetchSportsnetPlayers } = require('../src/services/sportsnet-players.service');
const { fetchSportsnetStandings } = require('../src/services/sportsnet-standings.service');

module.exports = async (req, res) => {
  // Only allow GET / HEAD (Vercel cron always sends GET)
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Protect with CRON_SECRET (optional but recommended)
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (cronSecret) {
    const authHeader = String(req.headers.authorization || '');
    const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (provided !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const results = {};
  const errors = {};

  // Force-refresh all three datasets and write to the persistent file cache
  await Promise.allSettled([
    fetchSportsnetMatches({ forceRefresh: true })
      .then((data) => { results.matches = { count: data.count, fetchedAt: data.fetchedAt }; })
      .catch((err) => { errors.matches = err.message; }),

    fetchSportsnetPlayers({ forceRefresh: true })
      .then((data) => { results.players = { teamCount: Object.keys(data.teams || {}).length, fetchedAt: data.fetchedAt }; })
      .catch((err) => { errors.players = err.message; }),

    fetchSportsnetStandings({ forceRefresh: true })
      .then((data) => { results.standings = { groupCount: (data.standings || []).length, fetchedAt: data.fetchedAt }; })
      .catch((err) => { errors.standings = err.message; })
  ]);

  const hasErrors = Object.keys(errors).length > 0;

  return res.status(hasErrors ? 207 : 200).json({
    ok: !hasErrors,
    refreshedAt: new Date().toISOString(),
    results,
    ...(hasErrors ? { errors } : {})
  });
};
