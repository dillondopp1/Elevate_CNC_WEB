/**
 * Zoho Invoice API — build-time item fetch
 * Credentials stored in .env / Netlify environment variables
 *
 * In-memory cache prevents hammering the API during dev server
 * hot-reloads. Cache TTL is 10 minutes.
 * Falls back to zoho_cache.json if the API is unreachable.
 */
import _fallbackData from './zoho_cache.json';
import _laserCatalog from './laser_catalog.json';

let _itemCache = null;
let _cacheAt   = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Laser Systems aren't in Zoho yet — this is a hand-maintained placeholder
 * catalog (src/lib/laser_catalog.json) in the same shape as a Zoho item, so
 * it drops straight into categorizeMachines()/groupBySeries() alongside
 * live-fetched routers and plasma tables.
 */
export function getLaserItems() {
  return _laserCatalog.machines;
}

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
    const items = applyOwnerOverrides(data.items || []);

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
  return applyOwnerOverrides(_fallbackData.items || []);
}

/**
 * Owner-confirmed spec corrections applied to Zoho description text.
 *
 * Zoho is the source of truth for pricing and most specs, but the owner has
 * confirmed three places where the Zoho entries are simply wrong. Detail pages
 * render these descriptions verbatim, so without this layer the site publishes
 * specs the owner has told us are false — most seriously, that the Ascent runs
 * on a household 110V outlet. A buyer acting on that would provision the wrong
 * electrical service before delivery.
 *
 * This runs on every item fetch (live and cached fallback), so the pages stay
 * correct even if the Zoho entries drift again. Once the Zoho descriptions are
 * fixed at the source these substitutions simply stop matching, and this
 * function can be deleted.
 *
 * Every pattern is anchored on "110V", "household", "electrical service", or
 * "Single Phase" so that unrelated text — notably the Ascent 4x8's
 * "Length: 110 in" — can never match.
 */
const OWNER_OVERRIDES = [
  // Ascent is 220V single-phase, NOT 110V household power.
  { match: /ascent/i, subs: [
    ['capable CNC system that operates entirely on standard household power while maintaining accuracy and rigidity',
     'capable CNC system that balances accuracy and rigidity'],
    ['while remaining accessible for users who do not require industrial electrical service',
     'while remaining accessible to smaller shops'],
    ['Router-based spindle system allows full machine operation on 110V power',
     'Router-based spindle system keeps the overall power requirement modest'],
    ['Designed for operation on standard 110V power',
     'Designed for operation on 220V single-phase power'],
    ['110V single-phase', '220V single-phase'],
    ['Standard household outlet', 'Dedicated 220V circuit required'],
  ] },
  // Apex is 220V THREE-phase, not single-phase.
  { match: /apex/i, subs: [
    ['220V Single Phase', '220V Three Phase'],
    ['220V single-phase', '220V three-phase'],
  ] },
];

function applyOwnerOverrides(items) {
  return items.map(item => {
    if (typeof item.description !== 'string') return item;
    const rule = OWNER_OVERRIDES.find(r => r.match.test(item.name || ''));
    if (!rule) return item;

    let description = item.description;
    for (const [from, to] of rule.subs) description = description.split(from).join(to);
    return description === item.description ? item : { ...item, description };
  });
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
  // Any Summit with a tool changer belongs to the ATC series — this also
  // catches "Summit PRO ATC 5X10", which would otherwise fall through to
  // Summit Series and render as a plain size next to the ATC card.
  if (/summit/i.test(name) && name.includes('ATC')) return 'Summit ATC';
  if (name.includes('Summit Lathe')) return 'Summit Lathe';
  if (name.includes('Summit') || name.includes('SUMMIT')) return 'Summit Series';
  if (name.includes('Apex')   || name.includes('APEX'))   return 'Apex Series';
  if (name.includes('BoreLine')) return 'BoreLine';
  if (name.includes('CO2 Laser'))   return 'CO2 Laser Series';
  if (name.includes('Fiber Laser')) return 'Fiber Laser Series';
  return '';
}

export function getMachineType(name) {
  if (name.includes('Spark') || name.includes('ION') || name.includes('Prime')) return 'CNC Plasma Table';
  if (name.includes('Lathe'))    return 'CNC Wood Lathe';
  if (name.includes('BoreLine')) return 'Side Hole Drilling';
  if (name.includes('CO2 Laser') || name.includes('Fiber Laser')) return 'Laser System';
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
  if (name.includes('Marking'))  return 'Marking';
  return getDisplayName(name);
}

const HEADER_PATTERN = /^(?:[A-Z][A-Za-z/]*|&)(?:\s(?:[A-Z][A-Za-z/]*|&))*$/;

function looksLikeHeader(line) {
  if (line.length > 40 || /[.:0-9]/.test(line)) return false;
  return HEADER_PATTERN.test(line);
}

/**
 * Parses a Zoho item's free-text description (blocks separated by blank
 * lines) into { title, sections: [{ heading, items[] }] } for display on a
 * machine detail page. Falls back gracefully on unstructured text.
 */
export function parseSpecSections(description) {
  if (!description) return { title: '', sections: [] };

  const blocks = description.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (!blocks.length) return { title: '', sections: [] };

  const title = blocks[0];
  const sections = [];
  let current = null;

  for (const block of blocks.slice(1)) {
    if (looksLikeHeader(block)) {
      current = { heading: block, items: [] };
      sections.push(current);
    } else if (current) {
      current.items.push(block);
    } else {
      current = { heading: 'Overview', items: [block] };
      sections.push(current);
    }
  }

  return { title, sections };
}
