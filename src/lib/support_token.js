import crypto from 'node:crypto';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

/** Issues a signed, time-limited access token. */
export function issueToken(secret) {
  const payload = JSON.stringify({ exp: Date.now() + TTL_MS });
  const payloadB64 = base64url(payload);
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/** Verifies a token's signature and expiry. Returns true/false. */
export function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = sign(payloadB64, secret);

  const sigBuf = Buffer.from(sig || '');
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}
