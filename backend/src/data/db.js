const { PrismaClient } = require('@prisma/client');
const env = require('../config/env');

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

const RETRY_DELAY_MS = 1200;
const MAX_ATTEMPTS = 2;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDbError(error) {
	if (!error) return false;

	const code = String(error.code || '').toUpperCase();
	const message = String(error.message || '').toLowerCase();

	if (code === 'P1001' || code === 'P1002') {
		return true;
	}

	const transientMarkers = [
		'can\'t reach database server',
		'timed out',
		'timeout',
		'connection terminated',
		'connection reset',
		'too many connections',
		'etimedout',
		'econnreset',
		'econnrefused'
	];

	return transientMarkers.some((marker) => message.includes(marker));
}

async function withRetry(operation) {
	let attempt = 1;

	while (attempt <= MAX_ATTEMPTS) {
		try {
			return await operation();
		} catch (error) {
			const canRetry = isTransientDbError(error) && attempt < MAX_ATTEMPTS;
			if (!canRetry) {
				throw error;
			}

			await sleep(RETRY_DELAY_MS);
			attempt += 1;
		}
	}

	return operation();
}

function wrapDelegate(delegate) {
	return new Proxy(delegate, {
		get(target, prop) {
			const value = target[prop];
			if (typeof value !== 'function') {
				return value;
			}

			return (...args) => withRetry(() => value.apply(target, args));
		}
	});
}

const prismaWithRetry = new Proxy(prisma, {
	get(target, prop) {
		const value = target[prop];

		if (value && typeof value === 'object') {
			return wrapDelegate(value);
		}

		if (typeof value === 'function') {
			return value.bind(target);
		}

		return value;
	}
});

module.exports = prismaWithRetry;