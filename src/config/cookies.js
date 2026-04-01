const env = require('./env');

function normalizeSameSite(value) {
  const raw = String(value || 'lax').trim().toLowerCase();
  if (raw === 'strict' || raw === 'lax' || raw === 'none') {
    return raw;
  }
  return 'lax';
}

function normalizeCookieDomain(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }

  return raw.replace(/^\.+/, '');
}

function resolveRequestHost(req) {
  const forwardedHost = req && req.headers ? req.headers['x-forwarded-host'] : '';
  const hostHeader = forwardedHost || (req && req.headers ? req.headers.host : '') || '';
  return String(Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function resolveCookieDomain(req) {
  const configuredDomain = normalizeCookieDomain(env.cookieDomain);
  if (!configuredDomain) {
    return undefined;
  }

  const requestHost = resolveRequestHost(req);
  if (!requestHost) {
    return configuredDomain;
  }

  if (requestHost === configuredDomain || requestHost.endsWith(`.${configuredDomain}`)) {
    return configuredDomain;
  }

  return undefined;
}

function getCookieBaseOptions(req) {
  const sameSite = normalizeSameSite(env.cookieSameSite);
  const secure = sameSite === 'none' ? true : env.cookieSecure;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    domain: resolveCookieDomain(req),
    maxAge: env.cookieMaxAgeMs
  };
}

function getCookieClearOptions(req) {
  const base = getCookieBaseOptions(req);
  return {
    httpOnly: base.httpOnly,
    secure: base.secure,
    sameSite: base.sameSite,
    path: base.path,
    domain: base.domain
  };
}

module.exports = {
  getCookieBaseOptions,
  getCookieClearOptions
};
