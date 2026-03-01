const backendOriginRaw = process.env.BACKEND_ORIGIN || process.env.BACKEND_URL || 'https://osk-kamenna-poruba-back.vercel.app';

function normalizeBackendOrigin(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const normalizedPath = String(parsed.pathname || '')
      .replace(/\/+$/, '')
      .replace(/\/api$/, '');

    return `${parsed.origin}${normalizedPath}`.replace(/\/+$/, '');
  } catch (_) {
    return raw.replace(/\/api$/, '');
  }
}

const BACKEND_ORIGIN = normalizeBackendOrigin(backendOriginRaw);

function buildTargetUrl(req) {
  const originalUrl = String(req.url || '/');
  const url = new URL(originalUrl, 'http://localhost');
  const targetPath = url.pathname.startsWith('/api') ? url.pathname : `/api${url.pathname}`;
  return `${BACKEND_ORIGIN}${targetPath}${url.search}`;
}

function filteredRequestHeaders(headers) {
  const nextHeaders = { ...headers };
  delete nextHeaders.host;
  delete nextHeaders['content-length'];
  delete nextHeaders.connection;
  delete nextHeaders['transfer-encoding'];
  delete nextHeaders['x-forwarded-host'];
  delete nextHeaders['x-forwarded-port'];
  delete nextHeaders['x-forwarded-proto'];
  return nextHeaders;
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }

      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  try {
    if (!BACKEND_ORIGIN.startsWith('http://') && !BACKEND_ORIGIN.startsWith('https://')) {
      return res.status(500).json({ message: 'Invalid BACKEND_ORIGIN. Use full URL including https://', backendOrigin: BACKEND_ORIGIN });
    }

    const targetUrl = buildTargetUrl(req);
    const method = String(req.method || 'GET').toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);
    const body = hasBody ? await readRequestBody(req) : undefined;

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: filteredRequestHeaders(req.headers || {}),
      body,
      redirect: 'manual'
    });

    const responseHeaders = {};
    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      responseHeaders['content-type'] = contentType;
    }

    const setCookie = upstreamResponse.headers.get('set-cookie');
    if (setCookie) {
      responseHeaders['set-cookie'] = setCookie;
    }

    Object.entries(responseHeaders).forEach(([key, value]) => {
      if (value) {
        res.setHeader(key, value);
      }
    });

    const bodyText = await upstreamResponse.text();
    return res.status(upstreamResponse.status).send(bodyText);
  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(502).json({
      message: 'Backend proxy error',
      detail: error && error.message ? error.message : 'unknown_error',
      backendOrigin: BACKEND_ORIGIN
    });
  }
};
