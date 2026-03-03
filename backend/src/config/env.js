const dotenv = require('dotenv');

dotenv.config({ override: true });

const nodeEnvRaw = String(process.env.NODE_ENV || 'development');
const defaultFrontendOrigin = nodeEnvRaw === 'production'
  ? 'https://*.vercel.app'
  : 'http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5501,http://localhost:5501';
const frontendOriginRaw = process.env.FRONTEND_ORIGIN || defaultFrontendOrigin;
const frontendOriginsNormalized = frontendOriginRaw.includes('YOUR_VERCEL_DOMAIN')
  ? 'https://*.vercel.app,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5501,http://localhost:5501'
  : frontendOriginRaw;
const defaultSportnetOrgId = '54b532721c6198f161840003';

const env = {
  nodeEnv: nodeEnvRaw,
  port: Number(process.env.PORT || 4000),
  trustProxy: process.env.TRUST_PROXY || (String(process.env.NODE_ENV || 'development') === 'production' ? '1' : 'false'),
  frontendOrigins: frontendOriginsNormalized
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_only_change_me',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  cookieName: process.env.COOKIE_NAME || 'osk_session',
  cookieSecure: String(process.env.COOKIE_SECURE || 'false') === 'true',
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
  sportnetApiBase: process.env.SPORTNET_API_BASE || process.env.SPORTSNET_API_BASE || '',
  sportnetOrgId: process.env.SPORTNET_ORG_ID || process.env.SPORTSNET_ORG_ID || defaultSportnetOrgId,
  sportnetMatchesPath: process.env.SPORTNET_MATCHES_PATH || process.env.SPORTSNET_MATCHES_PATH || '/organizations/{orgId}/matches',
  sportsnetApiUrl: process.env.SPORTNET_API_URL || process.env.SPORTSNET_API_URL || '',
  sportsnetApiKey: process.env.SPORTNET_API_KEY || process.env.SPORTSNET_API_KEY || '',
  sportsnetTeamId: process.env.SPORTSNET_TEAM_ID || '',
  sportsnetCompetitionId: process.env.SPORTSNET_COMPETITION_ID || '',
  sportsnetSeason: process.env.SPORTSNET_SEASON || '',
  sportsnetCacheSeconds: Number(process.env.SPORTSNET_CACHE_SECONDS || 300)
};

if (env.nodeEnv === 'production' && env.jwtAccessSecret === 'dev_only_change_me') {
  throw new Error('JWT_ACCESS_SECRET must be set in production');
}

module.exports = env;