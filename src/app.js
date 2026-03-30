const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const trainingsRoutes = require('./routes/trainings.routes');
const announcementsRoutes = require('./routes/announcements.routes');
const blogRoutes = require('./routes/blog.routes');
const pollsRoutes = require('./routes/polls.routes');
const usersRoutes = require('./routes/users.routes');
const playersRoutes = require('./routes/players.routes');
const sportsnetRoutes = require('./routes/sportsnet.routes');
const sportsnetPlayersRoutes = require('./routes/sportsnet-players.routes');
const contactRoutes = require('./routes/contact.routes');
const instagramRoutes = require('./routes/instagram.routes');
const groupsRoutes = require('./routes/groups.routes');
const cloudinaryRoutes = require('./routes/cloudinary.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

const trustProxyRaw = String(env.trustProxy || 'false').trim().toLowerCase();
if (trustProxyRaw === 'true') {
  app.set('trust proxy', true);
} else if (trustProxyRaw === 'false') {
  app.set('trust proxy', false);
} else {
  const parsedTrustProxy = Number(trustProxyRaw);
  app.set('trust proxy', Number.isNaN(parsedTrustProxy) ? trustProxyRaw : parsedTrustProxy);
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isOriginAllowed(origin, allowedOrigins) {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return allowedOrigins.some((allowed) => {
    if (!allowed.includes('*')) {
      return false;
    }

    const wildcardPattern = '^' + allowed.split('*').map(escapeForRegex).join('.*') + '$';
    return new RegExp(wildcardPattern).test(origin);
  });
}

// Ignore favicon requests (backend is API-only)
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.get('/favicon.png', (_req, res) => res.status(204).end());

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (isOriginAllowed(origin, env.frontendOrigins)) {
        return callback(null, true);
      }

      console.warn(`[CORS Error] Origin "${origin}" is not allowed. Whitelist: ${env.frontendOrigins.join(', ')}`);
      return callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/csrf-token' || req.path === '/api/csrf-token'
});

app.use('/api', apiRateLimiter);
app.use('/', apiRateLimiter);

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function handleCsrfTokenRequest(req, res) {
  const token = generateCsrfToken();
  res.cookie('_csrf', token, {
    httpOnly: false,
    secure: env.cookieSecure || env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 2
  });
  res.json({ csrfToken: token });
}

app.get('/api/csrf-token', handleCsrfTokenRequest);
app.get('/csrf-token', handleCsrfTokenRequest);

function csrfValidation(req, res, next) {
  if (!env.csrfProtection) return next();
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();
  const headerToken = req.headers['x-csrf-token'] || '';
  const cookieToken = req.cookies && req.cookies['_csrf'] || '';
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ message: 'Neplatný CSRF token. Obnovte stránku a skúste znova.' });
  }
  return next();
}

app.use(csrfValidation);

app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/', authRoutes);
app.use('/api/trainings', trainingsRoutes);
app.use('/trainings', trainingsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/announcements', announcementsRoutes);
app.use('/api/blog', blogRoutes);
app.use('/blog', blogRoutes);
app.use('/api/polls', pollsRoutes);
app.use('/polls', pollsRoutes);
app.use('/api/users', usersRoutes);
app.use('/users', usersRoutes);
app.use('/api/players', playersRoutes);
app.use('/players', playersRoutes);
app.use('/api/sportsnet', sportsnetRoutes);
app.use('/sportsnet', sportsnetRoutes);
app.use('/api/sportsnet', sportsnetPlayersRoutes);
app.use('/sportsnet', sportsnetPlayersRoutes);
app.use('/api/contact', contactRoutes);
app.use('/contact', contactRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/instagram', instagramRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/groups', groupsRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);
app.use('/cloudinary', cloudinaryRoutes);

app.get('/', (req, res) => {
  return res.json({
    status: 'ok',
    message: 'Backend API beží',
    health: '/api/health'
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;