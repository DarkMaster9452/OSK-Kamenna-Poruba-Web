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

function parseHostFromUrl(value) {
  try {
    return new URL(String(value || '')).hostname.toLowerCase();
  } catch (_) {
    return '';
  }
}

function resolveRequestHost(req) {
  const headers = req && req.headers ? req.headers : {};
  const candidates = [
    headers.origin,
    headers.referer,
    headers.referrer,
    headers['x-forwarded-host'],
    headers.host
  ];

  for (const candidate of candidates) {
    const rawValue = Array.isArray(candidate) ? candidate[0] : candidate;
    if (!rawValue) {
      continue;
    }

    const parsedUrlHost = parseHostFromUrl(rawValue);
    if (parsedUrlHost) {
      return parsedUrlHost;
    }

    const normalizedHost = String(rawValue).trim().toLowerCase().replace(/:\d+$/, '');
    if (normalizedHost) {
      return normalizedHost;
    }
  }

  return '';
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

function getCookieValueCandidates(req, cookieName) {
  const values = [];
  const seen = new Set();

  function pushValue(value) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    values.push(normalized);
  }

  if (req && req.cookies) {
    const parsedCookieValue = req.cookies[cookieName];
    if (Array.isArray(parsedCookieValue)) {
      parsedCookieValue.forEach(pushValue);
    } else {
      pushValue(parsedCookieValue);
    }
  }

  const rawCookieHeader = req && req.headers ? req.headers.cookie : '';
  String(rawCookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .forEach((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }

      const name = part.slice(0, separatorIndex).trim();
      if (name !== cookieName) {
        return;
      }

      pushValue(part.slice(separatorIndex + 1));
    });

  return values;
}

function clearAuthCookieVariants(res, req, cookieName) {
  const base = getCookieClearOptions(req);
  const domainsToClear = new Set();
  const requestHost = resolveRequestHost(req);
  const configuredDomain = normalizeCookieDomain(env.cookieDomain);

  domainsToClear.add('');
  if (requestHost) {
    domainsToClear.add(requestHost);
  }
  if (configuredDomain) {
    domainsToClear.add(configuredDomain);
  }

  domainsToClear.forEach((domain) => {
    const options = {
      httpOnly: base.httpOnly,
      secure: base.secure,
      sameSite: base.sameSite,
      path: base.path
    };

    if (domain) {
      options.domain = domain;
    }

    res.clearCookie(cookieName, options);
  });
}

module.exports = {
  getCookieBaseOptions,
  getCookieClearOptions,
  getCookieValueCandidates,
  clearAuthCookieVariants
};
