/**
 * airwallex.js — Airwallex authentication and authenticated fetch helper.
 *
 * Handles login via the demo API and caches the bearer token until expiry.
 * Uses only the verified endpoint: POST /api/v1/authentication/login
 */

const BASE_URL = 'https://api-demo.airwallex.com';

/** @type {{ token: string; expiresAt: number } | null} */
let cached = null;

/**
 * Authenticate with the Airwallex demo API and return a bearer token.
 * The token is cached in-memory and reused until it expires.
 *
 * @returns {Promise<string>} Bearer token string
 * @throws {Error} If credentials are missing or the login request fails
 */
export async function getAuthToken() {
  // Return cached token if still valid (with 30 s buffer)
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    return cached.token;
  }

  const apiKey = process.env.AIRWALLEX_API_KEY;
  const clientId = process.env.AIRWALLEX_CLIENT_ID;

  if (!apiKey || !clientId) {
    throw new Error(
      'Missing AIRWALLEX_API_KEY or AIRWALLEX_CLIENT_ID in environment'
    );
  }

  const res = await fetch(`${BASE_URL}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-client-id': clientId,
      // TODO: verify if additional headers (e.g. x-on-behalf-of) are needed
    },
    body: JSON.stringify({}), // TODO: verify if body payload is required
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airwallex login failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // TODO: verify exact response shape — expecting { token, expires_at }
  const token = data.token;
  const expiresAt = new Date(data.expires_at).getTime();

  if (!token || !expiresAt) {
    throw new Error(
      'Unexpected Airwallex login response: missing token or expires_at'
    );
  }

  cached = { token, expiresAt };
  return token;
}

/**
 * Make an authenticated fetch request to the Airwallex demo API.
 * Automatically attaches the cached bearer token (refreshing if needed).
 *
 * @param {string} path  — API path starting with / (e.g. /api/v1/pa/payment_disputes)
 * @param {RequestInit} [options={}] — Standard fetch options (method, body, etc.)
 * @returns {Promise<Response>} The raw fetch Response
 */
export async function authenticatedFetch(path, options = {}) {
  const token = await getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}
