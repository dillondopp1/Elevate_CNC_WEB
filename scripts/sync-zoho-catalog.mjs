#!/usr/bin/env node
/**
 * sync-zoho-catalog.mjs
 *
 * WHAT THIS DOES
 * Pulls the active items list from the Zoho Invoice API and re-syncs it into
 * `src/lib/machine_catalog.json`, the local snapshot that powers Dwight (the
 * sales chat agent in netlify/functions/chat.mjs). It preserves hand-assigned
 * fields (notably `line`, which cannot be derived from Zoho data) by matching
 * existing entries on SKU/name, and it preserves the laser placeholder entries
 * (line starting with "LASER") verbatim since those are not managed in Zoho.
 *
 * REQUIRES
 * A `.env` file in the project root with four credentials:
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID
 *
 * !! THIS SCRIPT OVERWRITES src/lib/machine_catalog.json !!
 * Only run it once the Zoho catalog itself is known-correct (accurate prices,
 * no discontinued items still listed as active, etc). Running it against a
 * stale or wrong Zoho catalog will bake that wrong data into Dwight's
 * knowledge and he will quote it to customers.
 *
 * Use `--dry-run` to fetch from Zoho and print the summary WITHOUT writing
 * anything, so you can sanity-check what Zoho currently holds before
 * deciding to commit a real sync.
 *
 * Usage:
 *   node scripts/sync-zoho-catalog.mjs           # fetch, print summary, write file
 *   node scripts/sync-zoho-catalog.mjs --dry-run  # fetch, print summary, write nothing
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY_RUN = process.argv.includes('--dry-run');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const CATALOG_PATH = path.join(REPO_ROOT, 'src', 'lib', 'machine_catalog.json');
const ENV_PATH = path.join(REPO_ROOT, '.env');

const REQUIRED_ENV_KEYS = [
  'ZOHO_CLIENT_ID',
  'ZOHO_CLIENT_SECRET',
  'ZOHO_REFRESH_TOKEN',
  'ZOHO_ORG_ID',
];

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    fail(
      `Missing ${ENV_PATH} in the project root. This script needs ZOHO_CLIENT_ID, ` +
      `ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_ORG_ID to authenticate with Zoho.`
    );
  }

  const env = Object.fromEntries(
    fs.readFileSync(ENV_PATH, 'utf8').split('\n')
      .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
      .map(m => [m[1], m[2]])
  );

  const missing = REQUIRED_ENV_KEYS.filter(k => !env[k]);
  if (missing.length > 0) {
    fail(
      `${ENV_PATH} is missing required credential(s): ${missing.join(', ')}. ` +
      `All four of ${REQUIRED_ENV_KEYS.join(', ')} must be set.`
    );
  }

  return env;
}

async function getAccessToken(env) {
  let tokenRes;
  try {
    tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.ZOHO_CLIENT_ID,
        client_secret: env.ZOHO_CLIENT_SECRET,
        refresh_token: env.ZOHO_REFRESH_TOKEN,
      }),
    });
  } catch (err) {
    fail(`Could not reach Zoho's token endpoint (network error): ${err.message}`);
  }

  let tokenJson;
  try {
    tokenJson = await tokenRes.json();
  } catch {
    fail(`Zoho token endpoint returned a non-JSON response (HTTP ${tokenRes.status}).`);
  }

  const { access_token, error } = tokenJson;
  if (!access_token) {
    fail(
      `Zoho token refresh failed${error ? ` (${error})` : ''}. ` +
      `Check that ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN in ${ENV_PATH} are valid.`
    );
  }

  return access_token;
}

async function fetchZohoItems(env, accessToken) {
  let res;
  try {
    res = await fetch(
      `https://www.zohoapis.com/invoice/v3/items?organization_id=${env.ZOHO_ORG_ID}&status=active&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
  } catch (err) {
    fail(`Could not reach Zoho's items endpoint (network error): ${err.message}`);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    fail(`Zoho items endpoint returned a non-JSON response (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    fail(
      `Zoho items request failed (HTTP ${res.status}): ${json.message ?? JSON.stringify(json)}`
    );
  }

  return json.items ?? [];
}

function loadExistingCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    fail(`Could not find existing catalog at ${CATALOG_PATH} to preserve hand-assigned fields from.`);
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

function formatCurrency(n) {
  return `$${Number(n).toLocaleString()}`;
}

async function main() {
  const env = loadEnv();
  const accessToken = await getAccessToken(env);
  const items = await fetchZohoItems(env, accessToken);

  const existing = loadExistingCatalog();

  // `line` values in the existing file are hand-assigned (e.g. 'Summit', 'BoreLine',
  // 'Plasma') and are NOT derivable from the SKU — deriving them would silently
  // change them and break findMachinesByLine() in netlify/functions/chat.mjs.
  // Preserve the existing value per item; only fall back for genuinely new items.
  const lineBySku = Object.fromEntries(existing.machines.map(m => [m.sku, m.line]));
  const lineByName = Object.fromEntries(existing.machines.map(m => [m.name, m.line]));

  const KEYWORDS = ['SPARK', 'ION', 'PRIME', 'ASCENT', 'RIDGE', 'SUMMIT', 'APEX', 'BORELINE'];
  const newItemWarnings = [];

  const machines = items
    .filter(i => KEYWORDS.some(k => i.name.toUpperCase().includes(k)))
    .map(i => {
      const line = lineBySku[i.sku] ?? lineByName[i.name] ?? null;
      if (line === null) {
        newItemWarnings.push(`${i.name} (${i.sku})`);
      }
      return {
        item_id: i.item_id,
        name: i.name,
        sku: i.sku,
        price: i.rate,
        description: i.description,
        status: i.status,
        product_type: i.product_type,
        line: line ?? '',
      };
    });

  // Laser items are placeholder-only and live outside Zoho; preserve them verbatim.
  const lasers = existing.machines.filter(m => String(m.line).startsWith('LASER'));

  // Print a human-readable summary of what would be written, BEFORE writing anything.
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Zoho sync summary — ${machines.length} machine(s) matched, ${lasers.length} laser placeholder(s) preserved:\n`);
  for (const m of machines) {
    console.log(`  ${m.name.padEnd(40)} ${formatCurrency(m.price).padStart(10)}   line: ${m.line || '(unassigned)'}`);
  }

  if (newItemWarnings.length > 0) {
    console.log(`\nWARNING: ${newItemWarnings.length} new item(s) had no existing entry to match against, so their 'line' was left blank:`);
    for (const w of newItemWarnings) {
      console.warn(`  - ${w} — assign its line manually before relying on this data.`);
    }
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Nothing written. Re-run without --dry-run to write the catalog.\n');
    return;
  }

  const output = { ...existing, machines: [...machines, ...lasers] };
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`\nSynced ${machines.length} Zoho machines + ${lasers.length} laser placeholders.`);
  console.log(`Written to: ${path.resolve(CATALOG_PATH)}\n`);
}

main().catch(err => fail(err.stack ?? err.message));
