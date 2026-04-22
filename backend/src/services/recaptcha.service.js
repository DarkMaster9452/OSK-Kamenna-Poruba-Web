const https = require('https');
const env = require('../config/env');

/**
 * Verifies a reCAPTCHA Enterprise token by calling the Assessment API.
 * Returns { valid: boolean, score: number, action: string }.
 * Throws if the API key or project ID is not configured.
 */
async function verifyRecaptchaToken(token, expectedAction) {
  if (!env.recaptchaApiKey || !env.recaptchaProjectId) {
    throw Object.assign(
      new Error('reCAPTCHA Enterprise is not configured on this server.'),
      { code: 'RECAPTCHA_NOT_CONFIGURED' }
    );
  }

  const body = JSON.stringify({
    event: {
      token,
      expectedAction,
      siteKey: env.recaptchaSiteKey
    }
  });

  const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(env.recaptchaProjectId)}/assessments?key=${encodeURIComponent(env.recaptchaApiKey)}`;

  const responseText = await new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  let assessment;
  try {
    assessment = JSON.parse(responseText);
  } catch {
    throw new Error('Invalid response from reCAPTCHA Enterprise API.');
  }

  const tokenProps = assessment.tokenProperties || {};
  const riskAnalysis = assessment.riskAnalysis || {};

  if (!tokenProps.valid) {
    return { valid: false, score: 0, action: tokenProps.action || '', reason: tokenProps.invalidReason || 'INVALID_TOKEN' };
  }

  const score = typeof riskAnalysis.score === 'number' ? riskAnalysis.score : 0;
  const action = tokenProps.action || '';

  return { valid: true, score, action };
}

module.exports = { verifyRecaptchaToken };
