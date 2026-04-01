const env = require('../config/env');
const { getCookieBaseOptions, getCookieValueCandidates } = require('../config/cookies');
const { verifyAccessToken, signAccessToken } = require('../services/token.service');
const { findUserById, findUserByUsername } = require('../data/repository');

function getTokenFromRequest(req) {
  const cookieTokens = getCookieValueCandidates(req, env.cookieName);
  if (cookieTokens.length > 0) return cookieTokens[0];

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

function verifyAnyAccessToken(tokens) {
  for (const token of tokens) {
    try {
      return {
        payload: verifyAccessToken(token),
        token
      };
    } catch (_) {
      // try the next candidate when duplicate stale cookies are present
    }
  }

  return null;
}

async function resolveAuthenticatedUser(payload) {
  const sub = String(payload?.sub || '').trim();
  const username = String(payload?.username || '').trim();

  if (!sub && !username) {
    return null;
  }

  if (sub) {
    const userById = await findUserById(sub);
    if (userById && userById.isActive) {
      return userById;
    }
  }

  if (username) {
    const userByUsername = await findUserByUsername(username);
    if (userByUsername && userByUsername.isActive) {
      return userByUsername;
    }
  }

  return null;
}

async function requireAuth(req, res, next) {
  const cookieTokens = getCookieValueCandidates(req, env.cookieName);
  const authToken = getTokenFromRequest(req);
  if (!authToken) {
    return res.status(401).json({ message: 'Neautorizované' });
  }

  try {
    const verified = cookieTokens.length > 0
      ? verifyAnyAccessToken(cookieTokens)
      : { payload: verifyAccessToken(authToken), token: authToken };

    if (!verified || !verified.payload) {
      return res.status(401).json({ message: 'Neautorizované' });
    }

    const payload = verified.payload;
    const user = await resolveAuthenticatedUser(payload);
    if (!user) {
      return res.status(401).json({ message: 'Neautorizované' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      playerCategory: user.playerCategory || null
    };

    const shouldRefreshToken = cookieTokens.length > 0;

    if (shouldRefreshToken) {
      const refreshedToken = signAccessToken({
        sub: user.id,
        username: user.username,
        role: user.role,
        playerCategory: user.playerCategory || null
      });

      res.cookie(env.cookieName, refreshedToken, getCookieBaseOptions(req));
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Neautorizované' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Neautorizované' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Nemáte oprávnenie na túto akciu' });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};