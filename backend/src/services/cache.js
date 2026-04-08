/**
 * Persistent DB-based cache helper for SportNet data.
 *
 * Replaces the ephemeral file-based cache with a PostgreSQL table via Prisma.
 * This guarantees the cache survives all Vercel serverless cold starts and scales across edges.
 */

const prisma = require('./../data/db');
const IS_TEST = String(process.env.NODE_ENV || '').toLowerCase() === 'test';

/**
 * Read a cached value from the database.
 * Returns the parsed `payload` object if found and not expired, otherwise `null`.
 *
 * @param {string} key  - Cache key, e.g. 'matches', 'players', 'standings'
 * @param {{ allowExpired?: boolean }} [options]
 * @returns {Promise<object|null>}
 */
async function readCache(key, options = {}) {
  if (IS_TEST) return null; // keep test environment clean

  const allowExpired = !!(options && options.allowExpired);

  try {
    const entry = await prisma.sportnetCache.findUnique({
      where: { key: String(key) }
    });

    if (!entry) return null;
    if (!allowExpired && new Date() > entry.expiresAt) return null; // expired

    return entry.payload || null;
  } catch (err) {
    console.error(`[DB Cache Error] readCache('${key}'):`, err.message);
    return null;
  }
}

/**
 * Write a value to the database cache.
 *
 * @param {string} key     - Cache key
 * @param {object} data    - Payload to cache
 * @param {number} ttlMs   - Time-to-live in milliseconds
 * @returns {Promise<void>}
 */
async function writeCache(key, data, ttlMs) {
  if (IS_TEST) return;

  try {
    const expiresAt = new Date(Date.now() + Math.max(0, ttlMs));
    await prisma.sportnetCache.upsert({
      where: { key: String(key) },
      update: {
        payload: data,
        expiresAt
      },
      create: {
        key: String(key),
        payload: data,
        expiresAt
      }
    });
  } catch (err) {
    console.error(`[DB Cache Error] writeCache('${key}'):`, err.message);
  }
}

/**
 * Delete a cache entry from the database.
 *
 * @param {string} key
 * @returns {Promise<void>}
 */
async function invalidateCache(key) {
  try {
    await prisma.sportnetCache.delete({
      where: { key: String(key) }
    });
  } catch (_) {
    // Non-fatal (might not exist)
  }
}

module.exports = { readCache, writeCache, invalidateCache };
