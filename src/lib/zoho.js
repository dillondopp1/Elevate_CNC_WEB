/**
 * Zoho Invoice API — build-time item fetch
 * Credentials stored in .env / Netlify environment variables
 *
 * In-memory cache prevents hammering the API during dev server
 * hot-reloads. Cache TTL is 10 minutes.
 * Falls back to zoho_cache.json if the API is unreachable.
 */
import _fallbackData from './zoho_cache.json';

let _itemCache = null;
let _cacheAt   = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchZohoItems() {
  if (_itemCache && Date.now() - _cacheAt < CACHE_TTL) {
    return _itemCache;
  }

  try {
    // Exchange refresh token for a fresh access token
    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: import.meta.env.ZOHO_CLIENT_ID,
        client_secret: import.meta.env.ZOHO_CLIENT_SECRET,
        refresh_token: import.meta.env.ZOHO_REFRESH_TOKEN,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.warn('[Zoho] Token refresh failed (rate limited?), using local cache.');
      return _itemCache || getFallbackItems();
    }

    // Fetch all active items
    const itemsRes = await fetch(
      `https://www.zohoapis.com/invoice/v3/items?organization_id=${import.meta.env.ZOHO_ORG_ID}&status=active&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` } }
    );
    const data = await itemsRes.json();
    const items = data.items || [];

    _itemCache = items;
    _cacheAt   = Date.now();
    return items;
  } catch (err) {
    console.error('[Zoho] Fetch error:', err);
    return _itemCache || getFallbackItems();
  }
}

/** Bundled snapshot so builds never fail when Zoho is unreachable */
function getFallbackItems() {
  return _fallbackData.items || [];
}

const MACHINE_KEYWORDS_UC = ['SPARK','ION','PRIME','ASCENT','RIDGE','SUMMIT','APEX','BORELINE'];

export function categorizeMachines(items) {
  const machines = items.filter(item => {
    const n = item.name.toUpperCase();
    return MACHINE_KEYWORDS_UC.some(k => n.includes(k));
  });

  const plasma = machines
    .filter(m => {
      const n = m.name.toUpperCase();
      return n.includes('SPARK') || n.includes('ION') || n.includes('PRIME');
    })
    .sort((a, b) => a.rate - b.rate);

  const routers = machines
    .filter(m => {
      const n = m.name.toUpperCase();
      return (
        n.includes('ASCENT') ||
        n.includes('RIDGE') ||
        (n.includes('SUMMIT') && !n.includes('LATHE')) ||
        n.includes('APEX')
      );
    })
    .sort((a, b) => a.rate - b.rate);

  const specialty = machines
    .filter(m => {
      const n = m.name.toUpperCase();
      return n.includes('BORELINE') || n.includes('LATHE');
    })
    .sort((a, b) => a.rate - b.rate);

  return { plasma, routers, specialty };
}

/** Monthly payment estimate — 60 months, 8% APR */
export function monthlyPayment(price) {
  const r = 0.08 / 12;
  const n = 60;
  return Math.round(price * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

/** First meaningful sentence from a Zoho item description */
export function getBlurb(desc) {
  if (!desc) return '';
  const lines = desc.split('\n').map(l => l.trim()).filter(l => l.length > 50);
  for (const line of lines) {
    if (
      !line.endsWith(':') &&
      !/^[A-Z\s\d×\/()\-–]+$/.test(line) && // skip all-caps headers
      !line.includes(' – ') &&               // skip "Elevate CNC X – Entry-Level..." title lines
      !line.startsWith('Elevate CNC ')       // skip brand name lines
    ) {
      return line.slice(0, 220);
    }
  }
  return '';
}

/** Extract "48" × 96"" style working area from description */
export function getWorkingArea(desc) {
  if (!desc) return null;
  const x = desc.match(/X Axis:\s*(\d+\.?\d*)\s*in/);
  const y = desc.match(/Y Axis:\s*(\d+\.?\d*)\s*in/);
  if (x && y) return `${x[1]}" × ${y[1]}"`;
  return null;
}

/** Strip "Elevate CNC" prefix and normalize casing */
export function getDisplayName(name) {
  return name
    .replace('Elevate CNC ', '')
    .replace('SUMMIT', 'Summit')
    .replace('APEX', 'Apex');
}

export function getSeries(name) {
  if (name.includes('Spark'))  return 'Spark Series';
  if (name.includes('ION'))    return 'ION Series';
  if (name.includes('Prime'))  return 'Prime Series';
  if (name.includes('Ascent')) return 'Ascent Series';
  if (name.includes('Ridge'))  return 'Ridge Series';
  if (name.includes('Summit ATC'))   return 'Summit ATC';
  if (name.includes('Summit Lathe')) return 'Summit Lathe';
  if (name.includes('Summit') || name.includes('SUMMIT')) return 'Summit Series';
  if (name.includes('Apex')   || name.includes('APEX'))   return 'Apex Series';
  if (name.includes('BoreLine')) return 'BoreLine';
  return '';
}

export function getMachineType(name) {
  if (name.includes('Spark') || name.includes('ION') || name.includes('Prime')) return 'CNC Plasma Table';
  if (name.includes('Lathe'))    return 'CNC Wood Lathe';
  if (name.includes('BoreLine')) return 'Side Hole Drilling';
  return 'CNC Router';
}

/** Extract a short size label from the machine name (e.g. "4×8", "ATC") */
export function getSize(name) {
  const m = name.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (m) return `${m[1]}×${m[2]}`;
  if (name.includes('ATC'))      return 'ATC';
  if (name.includes('Lathe'))    return '60×20';
  if (name.includes('BoreLine')) return 'DH';
  if (name.includes('Prime'))    return '4×4';
  if (name.includes('ION'))      return '4×4';
  return getDisplayName(name);
}
