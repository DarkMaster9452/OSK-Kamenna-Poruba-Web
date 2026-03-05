const env = require('./env');

function normalizeSameSite(value) {
  const raw = String(value || 'lax').trim().toLowerCase();
  if (raw === 'strict' || raw === 'lax' || raw === 'none') {
    return raw;
  }
  return 'lax';
}

function getCookieBaseOptions() {
  const sameSite = normalizeSameSite(env.cookieSameSite);
  const secure = sameSite === 'none' ? true : env.cookieSecure;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    domain: env.cookieDomain || undefined,
    maxAge: env.cookieMaxAgeMs
  };
}

function getCookieClearOptions() {
  const base = getCookieBaseOptions();
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
