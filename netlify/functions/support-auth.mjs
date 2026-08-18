import { issueToken } from '../../src/lib/support_token.js';

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { machineNumber, password } = JSON.parse(event.body || '{}');

    if (!machineNumber || !password) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Machine number and password are required' }) };
    }

    if (password !== process.env.SUPPORT_ACCESS_PASSWORD) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Incorrect password' }) };
    }

    const token = issueToken(process.env.SUPPORT_TOKEN_SECRET);
    return { statusCode: 200, headers, body: JSON.stringify({ token }) };
  } catch (err) {
    console.error('Support auth function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
