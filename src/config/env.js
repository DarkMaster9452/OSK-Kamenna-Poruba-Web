const dotenv = require('dotenv');

dotenv.config({ override: true });

// Auto-calculate current Slovak football season (July–June cycle)
const _now = new Date();
const _seasonStartYear = _now.getMonth() >= 6 ? _now.getFullYear() : _now.getFullYear() - 1;
const _currentSeason = `${_seasonStartYear}/${_seasonStartYear + 1}`;

const nodeEnvRaw = String(process.env.NODE_ENV || 'development');

// List of allowed origins - can be a comma-separated string in FRONTEND_ORIGIN
const allowedOriginsCsv = process.env.FRONTEND_ORIGIN || (
  nodeEnvRaw === 'production'
    ? 'https://*.vercel.app'
    : 'http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5501,http://localhost:5501'
);

// If Vercel sets VERCEL_URL, we automatically add it for seamless deployment
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

// Split and clean the list
const frontendOrigins = allowedOriginsCsv
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Additional domains from ALLOWED_DOMAINS env var (comma-separated, with or without https://)
const additionalDomains = (process.env.ALLOWED_DOMAINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.startsWith('https://') ? o : `https://${o}`);

// Inject VERCEL_URL if missing
if (vercelUrl && !frontendOrigins.includes(vercelUrl)) {
  frontendOrigins.push(vercelUrl);
}

// Always ensure wildcard for vercel.app in production
if (nodeEnvRaw === 'production' && !frontendOrigins.includes('https://*.vercel.app')) {
  frontendOrigins.push('https://*.vercel.app');
}

// Add additional domains
additionalDomains.forEach(domain => {
  if (!frontendOrigins.includes(domain)) {
    frontendOrigins.push(domain);
  }
});

// Hardcoded fallback for production domains
if (nodeEnvRaw === 'production' && !frontendOrigins.includes('https://oskkp.sk')) {
  frontendOrigins.push('https://oskkp.sk');
}

const env = {
  nodeEnv: nodeEnvRaw,
  port: Number(process.env.PORT || 4000),
  trustProxy: process.env.TRUST_PROXY || (nodeEnvRaw === 'production' ? '1' : 'false'),
  frontendOrigins,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_only_change_me',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '30m',
  cookieName: process.env.COOKIE_NAME || 'osk_session',
  cookieSecure: String(process.env.COOKIE_SECURE || (nodeEnvRaw === 'production' ? 'true' : 'false')) === 'true',
  cookieSameSite: process.env.COOKIE_SAME_SITE || (nodeEnvRaw === 'production' ? 'none' : 'lax'),
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  cookieMaxAgeMs: Number(process.env.COOKIE_MAX_AGE_MS || (1000 * 60 * 60 * 24 * 30)),
  csrfProtection: String(process.env.CSRF_PROTECTION || 'true') === 'true',
  emailNotificationsEnabled: String(process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false') === 'true',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false') === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || '',
  smtpFromName: process.env.SMTP_FROM_NAME || 'OŠK Kamenná Poruba',
  contactFormToEmail: process.env.CONTACT_FORM_TO_EMAIL || '',
  publicAppUrl: process.env.PUBLIC_APP_URL || (nodeEnvRaw === 'production' ? 'https://oskkp.sk' : 'http://localhost:5500'),
  passwordResetExpiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 30),
  sportnetAppSpace: process.env.SPORTNET_APP_SPACE || 'osk-kamenna-poruba.futbalnet.sk',
  sportnetApiBase: process.env.SPORTNET_API_BASE || process.env.SPORTSNET_API_BASE || '',
  sportnetOrgId: process.env.SPORTNET_ORG_ID || process.env.SPORTSNET_ORG_ID || '',
  sportnetMatchesPath: process.env.SPORTNET_MATCHES_PATH || process.env.SPORTSNET_MATCHES_PATH || '/organizations/{orgId}/matches',
  sportsnetApiUrl: process.env.SPORTNET_API_URL || process.env.SPORTSNET_API_URL || '',
  sportsnetApiKey: process.env.SPORTNET_API_KEY || process.env.SPORTSNET_API_KEY || '',
  sportsnetTeamId: process.env.SPORTSNET_TEAM_ID || '',
  sportsnetCompetitionId: process.env.SPORTSNET_COMPETITION_ID || '',
  sportsnetSeason: process.env.SPORTSNET_SEASON || _currentSeason,
  sportsnetCacheSeconds: Number(process.env.SPORTSNET_CACHE_SECONDS || 600),
  sportnetPlayersCacheSeconds: Number(process.env.SPORTNET_PLAYERS_CACHE_SECONDS || 600),
  sportnetCacheDir: process.env.SPORTNET_CACHE_DIR || '',
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  instagramUserId: process.env.INSTAGRAM_USER_ID || 'me',
  instagramFeedLimit: Number(process.env.INSTAGRAM_FEED_LIMIT || 8),
  instagramCacheSeconds: Number(process.env.INSTAGRAM_CACHE_SECONDS || 300),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryRootFolder: process.env.CLOUDINARY_ROOT_FOLDER || '',
  cloudinaryCacheSeconds: Number(process.env.CLOUDINARY_CACHE_SECONDS || 604800)
};

if (env.nodeEnv === 'production' && env.jwtAccessSecret === 'dev_only_change_me') {
  console.error('CRITICAL WARNING: JWT_ACCESS_SECRET is using default value in production. Please set it in ENVIRONMENT VARIABLES for security.');
}

module.exports = env;