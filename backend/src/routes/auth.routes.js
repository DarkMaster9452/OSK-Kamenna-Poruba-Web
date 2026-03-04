const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const env = require('../config/env');
const {
  findUserByUsername,
  findUserById,
  updateUserPassword,
  createAuditLog,
  createAnnouncement,
  listParentChildrenByParentId
} = require('../data/repository');
const { validateBody } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { signAccessToken } = require('../services/token.service');

const router = express.Router();

const loginSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(6).max(200)
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(8).max(200)
});

const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
const loginAttemptTracker = new Map();

const ADMIN_FAILED_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_FAILED_THRESHOLD = 3;
const ADMIN_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const adminFailedTracker = new Map();

function toLoginKey(username) {
  return String(username || '').trim().toLowerCase();
}

function getLoginAttemptEntry(username) {
  return loginAttemptTracker.get(toLoginKey(username));
}

function getLockRemainingMs(username) {
  const entry = getLoginAttemptEntry(username);
  if (!entry || !entry.lockedUntil) return 0;
  return entry.lockedUntil - Date.now();
}

function registerFailedLoginAttempt(username) {
  const key = toLoginKey(username);
  const now = Date.now();
  const current = loginAttemptTracker.get(key);

  if (!current || (current.lockedUntil && current.lockedUntil <= now)) {
    loginAttemptTracker.set(key, {
      failedCount: 1,
      lockedUntil: null
    });
    return { failedCount: 1, lockedUntil: null };
  }

  const failedCount = (current.failedCount || 0) + 1;
  const shouldLock = failedCount >= LOGIN_MAX_FAILED_ATTEMPTS;

  const updated = {
    failedCount: shouldLock ? 0 : failedCount,
    lockedUntil: shouldLock ? (now + LOGIN_LOCKOUT_MS) : null
  };

  loginAttemptTracker.set(key, updated);
  return updated;
}

function clearFailedLoginAttempts(username) {
  loginAttemptTracker.delete(toLoginKey(username));
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

async function handleAdminLoginFailure({ req, user, username }) {
  const targetsAdmin = Boolean(user && user.role === 'admin');
  if (!targetsAdmin) return;

  const key = (user && user.id) ? `user:${user.id}` : `username:${String(username || '').toLowerCase()}`;
  const now = Date.now();
  const entry = adminFailedTracker.get(key);

  if (!entry || (now - entry.firstFailedAt) > ADMIN_FAILED_WINDOW_MS) {
    adminFailedTracker.set(key, {
      count: 1,
      firstFailedAt: now,
      lastAlertAt: entry ? entry.lastAlertAt : 0
    });
  } else {
    entry.count += 1;
    adminFailedTracker.set(key, entry);
  }

  const current = adminFailedTracker.get(key);
  const ipAddress = getClientIp(req);

  try {
    await createAuditLog({
      actorUserId: user ? user.id : null,
      action: 'admin_login_failed_attempt',
      entityType: 'auth',
      entityId: user ? user.id : null,
      details: {
        username,
        ipAddress,
        userAgent: req.headers['user-agent'] || null,
        countInWindow: current.count
      }
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }

  const cooldownOk = !current.lastAlertAt || (now - current.lastAlertAt) > ADMIN_ALERT_COOLDOWN_MS;
  if (current.count >= ADMIN_FAILED_THRESHOLD && cooldownOk && user) {
    try {
      await createAnnouncement({
        title: 'Bezpečnostné upozornenie: Admin prihlásenie',
        message: `Detegované ${current.count} neúspešné pokusy o admin prihlásenie pre účet ${username}. IP: ${ipAddress}.`,
        target: 'admins',
        playerCategory: null,
        important: true
      }, user.id);

      current.lastAlertAt = now;
      adminFailedTracker.set(key, current);
    } catch (error) {
      console.error('Security announcement creation failed:', error);
    }
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 30
  };
}

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  const lockRemainingMs = getLockRemainingMs(username);
  if (lockRemainingMs > 0) {
    const remainingSeconds = Math.ceil(lockRemainingMs / 1000);
    return res.status(429).json({
      message: `Účet je dočasne zablokovaný po viacerých neúspešných pokusoch. Skúste znova o ${remainingSeconds} sekúnd.`
    });
  }

  const user = await findUserByUsername(username);

  if (!user || !user.isActive) {
    registerFailedLoginAttempt(username);
    await handleAdminLoginFailure({ req, user, username });
    return res.status(401).json({ message: 'Nesprávne prihlasovacie údaje' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    const attemptState = registerFailedLoginAttempt(username);

    if (attemptState.lockedUntil) {
      try {
        await createAuditLog({
          actorUserId: user.id,
          action: 'account_temporarily_locked',
          entityType: 'auth',
          entityId: user.id,
          details: {
            username,
            lockMinutes: LOGIN_LOCKOUT_MS / 60000,
            reason: 'failed_login_attempts'
          }
        });
      } catch (error) {
        console.error('Audit log write failed:', error);
      }
    }

    await handleAdminLoginFailure({ req, user, username });
    if (attemptState.lockedUntil) {
      return res.status(429).json({
        message: 'Účet bol dočasne zablokovaný na 5 minút po 5 neúspešných pokusoch.'
      });
    }

    return res.status(401).json({ message: 'Nesprávne prihlasovacie údaje' });
  }

  clearFailedLoginAttempts(username);

  if (user.role === 'admin') {
    adminFailedTracker.delete(`user:${user.id}`);
    adminFailedTracker.delete(`username:${String(username || '').toLowerCase()}`);
  }

  const token = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    playerCategory: user.playerCategory || null
  });

  res.cookie(env.cookieName, token, cookieOptions());

  try {
    await createAuditLog({
      actorUserId: user.id,
      action: 'login_success',
      entityType: 'auth',
      entityId: user.id,
      details: {
        username: user.username,
        role: user.role,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null
      }
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }

  return res.json({
    message: 'Prihlásenie úspešné',
    user: {
      username: user.username,
      role: user.role,
      playerCategory: user.playerCategory || null
    }
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie(env.cookieName, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure
  });
  return res.json({ message: 'Odhlásenie úspešné' });
});

router.post('/change-password', requireAuth, validateBody(changePasswordSchema), async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Neautorizované' });
  }

  if (user.lastPasswordChangeAt) {
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const elapsedMs = Date.now() - new Date(user.lastPasswordChangeAt).getTime();
    if (elapsedMs < oneWeekMs) {
      const remainingDays = Math.ceil((oneWeekMs - elapsedMs) / (24 * 60 * 60 * 1000));
      return res.status(429).json({
        message: `Heslo môžete zmeniť iba raz za týždeň. Skúste znova o ${remainingDays} dní.`
      });
    }
  }

  const sameAsCurrent = await bcrypt.compare(req.body.newPassword, user.passwordHash);
  if (sameAsCurrent) {
    return res.status(400).json({ message: 'Nové heslo musí byť odlišné od aktuálneho.' });
  }

  const newPasswordHash = await bcrypt.hash(req.body.newPassword, 12);
  await updateUserPassword(user.id, newPasswordHash);

  try {
    await createAuditLog({
      actorUserId: req.user.id,
      action: 'password_changed',
      entityType: 'auth',
      entityId: user.id,
      details: null
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }

  return res.json({ message: 'Heslo bolo úspešne zmenené.' });
});

router.get('/me', requireAuth, async (req, res) => {
  const parentChildren = req.user.role === 'parent'
    ? await listParentChildrenByParentId(req.user.id)
    : [];

  return res.json({
    user: {
      username: req.user.username,
      role: req.user.role,
      playerCategory: req.user.playerCategory || null,
      parentChildren
    }
  });
});

module.exports = router;