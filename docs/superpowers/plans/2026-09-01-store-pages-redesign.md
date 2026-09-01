# Store Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the collapsed accordion on `/machines` with a scannable card grid plus a router comparison table, restructure the machine detail pages around buyer questions, and correct every on-site spec claim that contradicts the Zoho catalog.

**Architecture:** Four new single-responsibility Astro components (`PhotoSlot`, `TrustBand`, `MachineCard`, `RouterComparison`) render from hand-curated per-series data added to the existing `META` object in `src/lib/machine_meta.js`. Prices continue to come from live Zoho at build time; only the descriptive specs are curated. The accordion markup and its toggle script are deleted.

**Tech Stack:** Astro 4 (static output), plain CSS in `src/styles/global.css`, no framework, no build-time data fetching changes.

## Global Constraints

- **Zoho is the authoritative spec source, EXCEPT for these three owner-confirmed overrides.** Where an override applies it wins, and the Zoho entry is what needs fixing:
  1. **Apex has an automatic tool changer** (Zoho omits it).
  2. **Apex is 220V three-phase** (Zoho says single-phase).
  3. **Ascent is 220V single-phase** (Zoho says 110V in three places).
- **The Ascent 110V / "household power" / "no electrician required" claim is FALSE and must be removed everywhere it appears.** Resulting router power specs: Ridge, Ascent, Summit, Summit ATC = 220V single-phase; Apex = 220V three-phase.
- **Never invent a spec.** If Zoho does not state a value, render an em dash (`—`) or omit the row. Do not infer, estimate, or carry over a value from a sibling series.
- **Key Specs Rule:** cards show only series-level constants (frame, drive, control, power). Size-varying specs (spindle HP, working area, price) appear only in the comparison table and per-configuration cards.
- **Tier badges (already decided):** Ridge = `ENTRY` / `badge-entry`; Ascent = `MID-RANGE` / `badge-mid`. Router display order is Ridge → Ascent → Summit → Summit ATC → Apex.
- **Photo-ready, no photos.** `PhotoSlot` must render a deliberate branded placeholder when no image exists, never a broken image box.
- **No test framework exists in this repo** (no devDependencies, scripts are `dev`/`build`/`preview` only). Do **not** add one. The verification cycle for every task is: `npm run build` succeeds → browser check on the dev server → commit.
- Existing CSS custom properties must be reused (`--accent`, `--dark`, `--light`, `--border`, `--text-muted`, `--font-head`, `--font-body`). Do not introduce new colors.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/machine_meta.js` (modify) | Per-series presentation data: badge, tagline, intro, `keySpecs`, `bestFor`, optional `image`, slug maps |
| `src/components/PhotoSlot.astro` (create) | Render an image, or a branded placeholder when `src` is absent |
| `src/components/TrustBand.astro` (create) | Reusable risk-reversal strip |
| `src/components/MachineCard.astro` (create) | One series card |
| `src/components/RouterComparison.astro` (create) | Side-by-side router spec table |
| `src/pages/machines.astro` (modify) | Swap accordion → cards, add trust band + comparison, delete toggle script |
| `src/pages/machines/[slug].astro` (modify) | Detail page restructure |
| `src/pages/machines/laser/[slug].astro` (modify) | Detail page restructure |
| `src/pages/index.astro` (modify) | Spec copy corrections + Ascent label reconciliation |
| `src/styles/global.css` (modify) | Card, trust band, photo slot, comparison styles |
| `scripts/sync-zoho-catalog.mjs` (create) | Re-sync Dwight's stale catalog snapshot from live Zoho |

---

### Task 1: Series data layer

**Files:**
- Modify: `src/lib/machine_meta.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `META[series].keySpecs` — `Array<{label: string, value: string}>`; `META[series].bestFor` — `string`; `META[series].image` — `string | null`. `ROUTER_SLUGS` reordered. Existing exports `slugForSeries(seriesName)`, `laserSlugForSeries(seriesName)`, `LASER_SLUGS` unchanged in signature.

All `keySpecs` values below are transcribed from the Zoho descriptions in `src/lib/machine_catalog.json`. Ridge states no spindle and no vacuum table; Ascent states no vacuum table. Those absences are intentional.

- [ ] **Step 1: Swap the Ridge/Ascent badges and add per-series fields**

In `META`, update these two entries' `badge`/`cls` and add `keySpecs`, `bestFor`, `image` to all router entries:

```js
  'Ridge Series':  { badge:'ENTRY', cls:'badge-entry',
    tagline:'Extrusion-Based CNC Router',
    intro:'Rigid aluminum extrusion frame with rack-and-pinion drive and Centroid CNC12 control. X/Y resolution to 0.0005". Modular design supports future upgrades and custom configurations.',
    bestFor:'Serious hobbyists and small shops wanting a modular platform that can be upgraded over time.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Aluminum extrusion' },
      { label:'Drive',   value:'Rack & pinion (X/Y)' },
      { label:'Control', value:'Centroid CNC12' },
      { label:'Power',   value:'220V single-phase' },
    ] },
  'Ascent Series': { badge:'MID-RANGE', cls:'badge-mid',
    tagline:'Steel-Base CNC Router',
    intro:'Welded steel lower frame with an aluminum extrusion gantry, straight-tooth rack-and-pinion drive, and FluidNC control. A real CNC platform, not a kit.',
    bestFor:'Small shops wanting a welded steel base and straightforward FluidNC control.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Welded steel base, aluminum gantry' },
      { label:'Drive',   value:'Straight-tooth rack & pinion (X/Y)' },
      { label:'Control', value:'FluidNC' },
      { label:'Power',   value:'220V single-phase' },
    ] },
```

**Override #3 applies here.** The previous `tagline`, `intro`, `bestFor`, and `Power` all asserted 110V / household-outlet operation, which the owner has confirmed is false. Every one of those four fields changed. Do not restore the 110V wording from the existing file — the existing file is what is wrong.

```js
```

- [ ] **Step 2: Add the same fields to the three remaining router series**

```js
  'Summit Series': { badge:'PRODUCTION', cls:'badge-pro',
    tagline:'Industrial Production CNC Router',
    intro:'Fully welded steel frame, helical rack-and-pinion drive, full vacuum table, auto-lubrication, and Centroid CNC12. Built for cabinet shops and sign makers who need daily reliability.',
    bestFor:'Cabinet shops and sign makers running production work every day.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Fully welded steel' },
      { label:'Drive',   value:'Helical rack & pinion (X/Y)' },
      { label:'Table',   value:'Full vacuum table' },
      { label:'Power',   value:'220V single-phase' },
    ] },
  'Summit ATC':    { badge:'PRODUCTION+', cls:'badge-pro',
    tagline:'Summit with Automatic Tool Change',
    intro:'The full Summit platform upgraded with a 6HP ATC spindle, 8-position linear tool rack, BT30/ER25 holders, and automatic tool length setter. Compressed air required for operation.',
    bestFor:'Production shops running multi-tool jobs that lose time to manual tool changes.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Fully welded steel' },
      { label:'Spindle', value:'6 HP ATC, 24,000 RPM' },
      { label:'Control', value:'Centroid CNC12' },
      { label:'Power',   value:'220V single-phase + air' },
    ] },
  'Apex Series':   { badge:'INDUSTRIAL', cls:'badge-industrial',
    tagline:'Industrial Production CNC Router',
    intro:'1500W AC servo motors with closed-loop feedback, 12HP spindle, 1,200 IPM rapid speed, centralized auto-lubrication, and Centroid CNC12. The flagship router in the Elevate CNC lineup.',
    bestFor:'High-volume manufacturers where speed and uptime matter more than upfront cost.',
    image: null,
    keySpecs: [
      { label:'Frame',   value:'Fully welded steel' },
      { label:'Motors',  value:'1500W AC servo, closed loop' },
      { label:'Control', value:'Centroid CNC12' },
      { label:'Power',   value:'220V three-phase' },
    ] },
```

- [ ] **Step 3: Reorder `ROUTER_SLUGS` so Ridge leads**

`ROUTER_SLUGS` key order drives prev/next nav on detail pages, so it must match the new tier order:

```js
export const ROUTER_SLUGS = {
  'ridge': 'Ridge Series',
  'ascent': 'Ascent Series',
  'summit': 'Summit Series',
  'summit-atc': 'Summit ATC',
  'apex': 'Apex Series',
};
```

- [ ] **Step 4: Add `keySpecs`/`bestFor`/`image` to laser, plasma, and specialty series**

```js
  'CO2 Laser Series': { badge:'ENTRY', cls:'badge-entry',
    tagline:'CO2 Laser Cutter & Engraver',
    intro:'Cuts and engraves wood, acrylic, leather, fabric, and other non-metals. A sealed CO2 tube system built for makers, sign shops, and small production runs that need clean edges without router setup.',
    bestFor:'Sign shops and makers cutting non-metals who want clean edges without router setup.',
    image: null,
    keySpecs: [
      { label:'Cuts',    value:'Wood, acrylic, leather, fabric' },
      { label:'Source',  value:'Sealed CO2 tube' },
      { label:'Control', value:'LightBurn-compatible' },
      { label:'Power',   value:'110V / 220V by size' },
    ] },
  'Fiber Laser Series': { badge:'PRODUCTION', cls:'badge-pro',
    tagline:'Fiber Laser Marking & Cutting',
    intro:'Marks and cuts metal — mild steel, stainless, aluminum, and more — with a clean, fast, no-contact process. No consumables, no secondary finishing.',
    bestFor:'Metal fabricators and shops marking parts who need permanent results with no consumables.',
    image: null,
    keySpecs: [
      { label:'Cuts',    value:'Steel, stainless, aluminum, brass' },
      { label:'Source',  value:'Sealed fiber laser' },
      { label:'Control', value:'EZCad / Cypcut-compatible' },
      { label:'Power',   value:'110V marking / 220V cutting' },
    ] },
```

- [ ] **Step 4b: Add `image` and `bestFor` to plasma and specialty series — no `keySpecs`**

Zoho does not state a consistent frame/drive/control/power set for these five (no power requirement for Spark, ION, Prime, or BoreLine; no drive for Summit Lathe). Rather than fabricate them, these series intentionally **omit `keySpecs` entirely** — `MachineCard` guards with `meta.keySpecs?.length > 0`, so the card renders correctly without the spec block. Plasma is archived and specialty is a minor line, so this is the honest treatment, not a gap.

Add only these two fields to each (the `bestFor` strings are condensed from each series' existing `intro` text, which is existing site copy — not new spec claims):

```js
  // add to each of the five entries, alongside their existing fields:
  'Spark Series':  { /* …existing… */ image: null,
    bestFor:'Hobbyists and makers cutting steel in a garage or small shop.' },
  'ION Series':    { /* …existing… */ image: null,
    bestFor:'Shops wanting automatic material sensing and better cut consistency.' },
  'Prime Series':  { /* …existing… */ image: null,
    bestFor:'Production shops cutting steel daily that need torch height control.' },
  'Summit Lathe':  { /* …existing… */ image: null,
    bestFor:'Furniture makers, stair builders, and column shops.' },
  'BoreLine':      { /* …existing… */ image: null,
    bestFor:'Cabinet and furniture shops doing high-volume side drilling.' },
```

- [ ] **Step 5: Verify the module parses and exports correctly**

Run:
```bash
node --input-type=module -e "import('./src/lib/machine_meta.js').then(m => { const k = Object.keys(m.ROUTER_SLUGS); console.log('order:', k.join(' -> ')); console.log('Ridge badge:', m.META['Ridge Series'].badge); console.log('Ascent badge:', m.META['Ascent Series'].badge); console.log('Summit keySpecs:', m.META['Summit Series'].keySpecs.length); })"
```
Expected: `order: ridge -> ascent -> summit -> summit-atc -> apex`, `Ridge badge: ENTRY`, `Ascent badge: MID-RANGE`, `Summit keySpecs: 4`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/machine_meta.js
git commit -m "Add per-series key specs and swap Ridge/Ascent tier badges"
```

---

### Task 2: PhotoSlot component

**Files:**
- Create: `src/components/PhotoSlot.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `META[series].image` from Task 1.
- Produces: `<PhotoSlot src={string|null} alt={string} label={string} />`. When `src` is null/empty it renders `.photo-slot--empty` with the branded placeholder; otherwise an `<img>` with `loading="lazy"`.

- [ ] **Step 1: Create the component**

```astro
---
export interface Props {
  src?: string | null;
  alt: string;
  label?: string;
}
const { src = null, alt, label = '' } = Astro.props;
---
{src
  ? <div class="photo-slot"><img src={src} alt={alt} loading="lazy" /></div>
  : (
    <div class="photo-slot photo-slot--empty" role="img" aria-label={`${alt} — photo coming soon`}>
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M3 17l6-6 4 4 3-3 5 5" /><rect x="3" y="4" width="18" height="16" rx="1" /><circle cx="8.5" cy="8.5" r="1.5" />
      </svg>
      {label && <span class="photo-slot-label">{label}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Add styles to `src/styles/global.css`**

```css
.photo-slot { width: 100%; aspect-ratio: 16 / 10; overflow: hidden; background: var(--dark-2); }
.photo-slot img { width: 100%; height: 100%; object-fit: cover; }
.photo-slot--empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  background: linear-gradient(135deg, var(--dark-2) 0%, var(--dark-3) 100%);
  color: var(--grey-light);
}
.photo-slot-label {
  font-family: var(--font-head); font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.65;
}
```

- [ ] **Step 3: Build to verify it compiles**

Run: `npm run build`
Expected: build completes, `15 page(s) built`.

- [ ] **Step 4: Commit**

```bash
git add src/components/PhotoSlot.astro src/styles/global.css
git commit -m "Add PhotoSlot component with branded empty state"
```

---

### Task 3: TrustBand component

**Files:**
- Create: `src/components/TrustBand.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `<TrustBand />` — takes no props, renders four fixed items.

Claims must be limited to what is verifiable from the Zoho catalog and existing site content: every machine description states "1-Year Limited Warranty"; financing has a live page; pricing is published on the site; and "any size, any feature" is the owner's stated core positioning for custom builds. Do **not** add claims like "free shipping" or "lifetime support".

**Owner decision (2026-09-01):** the third slot is the custom-build differentiator, **not** setup/training. The owner explicitly asked that support messaging be de-emphasized site-wide, so a support-flavored claim must not occupy prime space on every machine page.

The border color `#2a2a2a` matches the existing `.navbar` / `.topbar` dark-section borders already in `global.css` — use that rather than introducing a new rgba value.

- [ ] **Step 1: Create the component**

```astro
---
const items = [
  { label: 'Published Pricing',    detail: 'Real prices, not "call for quote"' },
  { label: '1-Year Warranty',      detail: 'Included on every machine' },
  { label: 'Any Size, Any Feature', detail: 'Custom-built to your spec' },
  { label: 'Financing Available',  detail: 'For qualified buyers' },
];
---
<div class="trust-band">
  <div class="container trust-band-inner">
    {items.map(i => (
      <div class="trust-item">
        <span class="trust-item-label">{i.label}</span>
        <span class="trust-item-detail">{i.detail}</span>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Add styles**

```css
.trust-band { background: var(--dark-2); border-bottom: 1px solid #2a2a2a; }
.trust-band-inner {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 16px; padding-top: 18px; padding-bottom: 18px;
}
.trust-item { display: flex; flex-direction: column; gap: 2px; text-align: center; }
.trust-item-label {
  font-family: var(--font-head); font-size: 0.85rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--white);
}
.trust-item-detail { font-size: 0.78rem; color: var(--grey-light); }
@media (max-width: 700px) {
  .trust-band-inner { grid-template-columns: repeat(2, 1fr); gap: 14px; }
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TrustBand.astro src/styles/global.css
git commit -m "Add reusable TrustBand component"
```

---

### Task 4: MachineCard component

**Files:**
- Create: `src/components/MachineCard.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `PhotoSlot` (Task 2); `META` shape from Task 1.
- Produces: `<MachineCard seriesName={string} meta={object} variants={array} detailHref={string|null} featured={boolean} />`. `variants` is the array of Zoho items for the series (each having `.name`, `.rate`, `.description`). `detailHref` null renders no "View Full Specs" button.

- [ ] **Step 1: Create the component**

```astro
---
import PhotoSlot from './PhotoSlot.astro';
import { monthlyPayment, getSize } from '../lib/zoho.js';

export interface Props {
  seriesName: string;
  meta: any;
  variants: any[];
  detailHref?: string | null;
  featured?: boolean;
}
const { seriesName, meta, variants, detailHref = null, featured = false } = Astro.props;

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US');
const prices = variants.map(v => v.rate);
const minPrice = Math.min(...prices);
const maxPrice = Math.max(...prices);
const sizes = variants.map(v => getSize(v.name));
---
<article class={`machine-card${featured ? ' machine-card--featured' : ''}`}>
  {featured && <div class="machine-card-flag">Most Popular</div>}
  <PhotoSlot src={meta.image} alt={seriesName} label={seriesName} />
  <div class="machine-card-body">
    <span class={`s-badge ${meta.cls}`}>{meta.badge}</span>
    <h3 class="machine-card-name">{seriesName}</h3>
    <p class="machine-card-tag">{meta.tagline}</p>

    {meta.keySpecs?.length > 0 && (
      <dl class="machine-card-specs">
        {meta.keySpecs.map((s: any) => (
          <div class="machine-card-spec">
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    )}

    <div class="machine-card-price">
      <span class="machine-card-price-value">
        {prices.length > 1 ? `${fmt(minPrice)} – ${fmt(maxPrice)}` : fmt(minPrice)}
      </span>
      <span class="machine-card-price-mo">Est. {fmt(monthlyPayment(minPrice))}/mo</span>
    </div>
    <p class="machine-card-sizes">{sizes.length} size{sizes.length > 1 ? 's' : ''}: {sizes.join(' · ')}</p>

    <div class="machine-card-actions">
      {detailHref && <a href={detailHref} class="btn btn-dark machine-card-btn">View Full Specs</a>}
      <a href="/#contact" class="btn btn-primary machine-card-btn">Get a Quote</a>
    </div>
  </div>
</article>
```

- [ ] **Step 2: Add styles**

```css
.machine-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 24px; margin-top: 32px; }
.machine-card { position: relative; display: flex; flex-direction: column; background: var(--white); border: 1px solid var(--border); transition: border-color 0.2s, transform 0.2s; }
.machine-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.machine-card--featured { border-color: var(--accent); box-shadow: 0 8px 30px rgba(26,110,216,0.12); }
.machine-card-flag {
  position: absolute; top: 0; right: 0; z-index: 2; background: var(--accent); color: #fff;
  font-family: var(--font-head); font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; padding: 5px 12px;
}
.machine-card-body { display: flex; flex-direction: column; flex: 1; padding: 22px; gap: 4px; }
.machine-card-name { font-family: var(--font-head); font-size: 1.4rem; font-weight: 800; text-transform: uppercase; color: var(--dark); margin-top: 10px; }
.machine-card-tag { font-size: 0.88rem; color: var(--text-muted); margin-bottom: 14px; }
.machine-card-specs { display: flex; flex-direction: column; gap: 7px; padding: 14px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 14px; }
.machine-card-spec { display: grid; grid-template-columns: 78px 1fr; gap: 10px; align-items: baseline; }
.machine-card-spec dt { font-family: var(--font-head); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.machine-card-spec dd { font-size: 0.86rem; color: var(--text); }
.machine-card-price { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.machine-card-price-value { font-family: var(--font-head); font-size: 1.5rem; font-weight: 800; color: var(--dark); }
.machine-card-price-mo { font-size: 0.8rem; color: var(--text-muted); }
.machine-card-sizes { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; }
.machine-card-actions { display: flex; gap: 10px; margin-top: auto; padding-top: 18px; }
.machine-card-btn { flex: 1; justify-content: center; padding: 11px 14px; font-size: 0.8rem; }
@media (max-width: 520px) { .machine-card-actions { flex-direction: column; } }
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MachineCard.astro src/styles/global.css
git commit -m "Add MachineCard component"
```

---

### Task 5: Replace the accordion on /machines

**Files:**
- Modify: `src/pages/machines.astro`

**Interfaces:**
- Consumes: `MachineCard` (Task 4), `TrustBand` (Task 3), `META`/`slugForSeries`/`laserSlugForSeries` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update imports and the router series order**

Add to the frontmatter imports:

```js
import MachineCard from '../components/MachineCard.astro';
import TrustBand from '../components/TrustBand.astro';
```

Change the router order constant so Ridge leads:

```js
const routerSeries = ['Ridge Series','Ascent Series','Summit Series','Summit ATC','Apex Series'].filter(s => routerByS[s]);
```

- [ ] **Step 2: Insert `<TrustBand />` immediately after the closing `</nav>` of the category jump nav**

- [ ] **Step 3: Replace each `<div class="series-list">…</div>` block with a card grid**

For the routers section:

```astro
      <div class="machine-grid">
        {routerSeries.map(seriesKey => (
          <MachineCard
            seriesName={seriesKey}
            meta={META[seriesKey]}
            variants={routerByS[seriesKey]}
            detailHref={slugForSeries(seriesKey) ? `/machines/${slugForSeries(seriesKey)}` : null}
            featured={seriesKey === 'Summit Series'}
          />
        ))}
      </div>
```

Repeat for lasers (`laserSeries` / `laserByS` / `laserSlugForSeries(seriesKey) ? \`/machines/laser/${laserSlugForSeries(seriesKey)}\` : null`), plasma (`plasmaSeries` / `plasmaByS`, `detailHref={null}`), and specialty (`specSeries` / `specByS`, `detailHref={null}`). Only Summit Series passes `featured`.

- [ ] **Step 4: Delete the accordion toggle script**

Remove the entire `<script>` block containing `document.querySelectorAll('.series-toggle')` at the bottom of the page. No accordions remain, so the script is dead code.

- [ ] **Step 5: Build and verify in the browser**

Run: `npm run build`
Expected: build completes, `15 page(s) built`.

Then start the dev server and confirm on `/machines`: every series shows price and key specs with no clicking; Ridge appears before Ascent; Ridge is badged `ENTRY` and Ascent `MID-RANGE`; Summit shows the "Most Popular" flag; no console errors other than the known missing `/images/*.jpg` 404s.

- [ ] **Step 6: Commit**

```bash
git add src/pages/machines.astro
git commit -m "Replace machines accordion with scannable card grid"
```

---

### Task 6: Router comparison table

**Files:**
- Create: `src/components/RouterComparison.astro`
- Modify: `src/pages/machines.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `META` (Task 1); router grouping from `machines.astro`.
- Produces: `<RouterComparison series={string[]} bySeries={Record<string, any[]>} />`.

Row values are transcribed from Zoho. Ridge states no spindle and no vacuum table; Ascent states no vacuum table; Apex states a vacuum *system* in its electrical requirements but no vacuum *table*. These render as `—` or the exact stated wording — never an inferred value.

- [ ] **Step 1: Create the component**

```astro
---
import { monthlyPayment, getSize } from '../lib/zoho.js';
export interface Props { series: string[]; bySeries: Record<string, any[]>; }
const { series, bySeries } = Astro.props;
const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US');

const SPEC_ROWS: Record<string, Record<string, string>> = {
  'Spindle': {
    'Ridge Series': '—',
    'Ascent Series': '2.5 HP router',
    'Summit Series': '3–10 HP by size',
    'Summit ATC': '6 HP ATC',
    'Apex Series': '12 HP',
  },
  'Drive System': {
    'Ridge Series': 'Rack & pinion',
    'Ascent Series': 'Straight-tooth rack & pinion',
    'Summit Series': 'Helical rack & pinion',
    'Summit ATC': 'Helical rack & pinion',
    'Apex Series': 'Helical R&P + AC servo',
  },
  'Vacuum Table': {
    'Ridge Series': '—',
    'Ascent Series': '—',
    'Summit Series': 'Full vacuum table',
    'Summit ATC': 'Full vacuum table',
    'Apex Series': 'Vacuum system',
  },
  'Tool Change': {
    'Ridge Series': 'Manual',
    'Ascent Series': 'Manual',
    'Summit Series': 'Manual',
    'Summit ATC': 'Automatic',
    'Apex Series': 'Automatic',
  },
  'Control': {
    'Ridge Series': 'Centroid CNC12',
    'Ascent Series': 'FluidNC',
    'Summit Series': 'Centroid CNC12',
    'Summit ATC': 'Centroid CNC12',
    'Apex Series': 'Centroid CNC12',
  },
  'Power': {
    'Ridge Series': '220V single-phase',
    'Ascent Series': '110V single-phase',
    'Summit Series': '220V single-phase',
    'Summit ATC': '220V single-phase + air',
    'Apex Series': '220V single-phase',
  },
};
---
<div class="comp-table-wrap">
  <table class="comp-table">
    <thead>
      <tr>
        <th>Feature</th>
        {series.map(s => <th>{s.replace(' Series','')}</th>)}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Starting Price</td>
        {series.map(s => <td>{fmt(Math.min(...bySeries[s].map(v => v.rate)))}</td>)}
      </tr>
      <tr>
        <td>Est. Monthly</td>
        {series.map(s => <td>{fmt(monthlyPayment(Math.min(...bySeries[s].map(v => v.rate))))}/mo</td>)}
      </tr>
      <tr>
        <td>Sizes</td>
        {series.map(s => <td>{bySeries[s].map(v => getSize(v.name)).join(', ')}</td>)}
      </tr>
      {Object.entries(SPEC_ROWS).map(([row, values]) => (
        <tr>
          <td>{row}</td>
          {series.map(s => <td>{values[s] ?? '—'}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

The table intentionally ends after the `Power` row. `bestFor` is long prose and belongs on the cards and detail pages, not in a comparison cell.

- [ ] **Step 2: Add mobile scroll styles**

The homepage already defines `.comp-table` and `.comp-table-wrap`. Add only the locked-first-column behavior:

```css
@media (max-width: 800px) {
  .comp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .comp-table { min-width: 680px; }
  .comp-table td:first-child, .comp-table th:first-child {
    position: sticky; left: 0; background: var(--white); z-index: 1;
  }
}
```

- [ ] **Step 3: Wire it into `machines.astro` directly below the router card grid**

```astro
      <div style="margin-top: 56px;">
        <p class="section-label">Compare</p>
        <h3 class="section-title" style="font-size: 1.8rem;">Router Comparison</h3>
        <div class="title-rule"></div>
        <RouterComparison series={routerSeries} bySeries={routerByS} />
      </div>
```

Add `import RouterComparison from '../components/RouterComparison.astro';` to the frontmatter.

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: build completes. In the browser, confirm the table renders all five router columns in Ridge → Apex order, that Ridge's Spindle and Vacuum Table cells show `—`, and that the table scrolls horizontally with a locked first column at a 375px viewport.

- [ ] **Step 5: Commit**

```bash
git add src/components/RouterComparison.astro src/pages/machines.astro src/styles/global.css
git commit -m "Add router comparison table"
```

---

### Task 7: Restructure the router detail page

**Files:**
- Modify: `src/pages/machines/[slug].astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `PhotoSlot` (Task 2), `TrustBand` (Task 3), `META.keySpecs`/`bestFor` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add imports**

```js
import PhotoSlot from '../../components/PhotoSlot.astro';
import TrustBand from '../../components/TrustBand.astro';
```

- [ ] **Step 2: Add the photo and at-a-glance spec strip inside the existing `.model-overview` left column, above `{meta.intro}`**

```astro
          <PhotoSlot src={meta.image} alt={seriesName} label={seriesName} />
          <dl class="spec-strip">
            {meta.keySpecs?.map((s: any) => (
              <div class="spec-strip-item">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
```

- [ ] **Step 3: Add the "Best suited for" line directly below `{meta.intro}`**

```astro
          {meta.bestFor && (
            <p class="model-bestfor"><strong>Best suited for:</strong> {meta.bestFor}</p>
          )}
```

- [ ] **Step 4: Add `<TrustBand />` immediately above the "Full Specifications" section**

- [ ] **Step 5: Add styles**

```css
.spec-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-top: 20px; padding: 18px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.spec-strip-item { display: flex; flex-direction: column; gap: 3px; }
.spec-strip-item dt { font-family: var(--font-head); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
.spec-strip-item dd { font-size: 0.92rem; font-weight: 600; color: var(--dark); }
.model-bestfor { margin-top: 18px; font-size: 0.95rem; color: var(--text); }
.model-bestfor strong { font-family: var(--font-head); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.85rem; }
```

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: build completes, all five router detail pages generated.

In the browser, open `/machines/ridge` and `/machines/apex`. Confirm: photo placeholder renders as a branded box (not a broken image), the spec strip shows the four key specs, "Best suited for" appears, and the prev/next nav at the bottom follows Ridge → Ascent → Summit → Summit ATC → Apex (so `/machines/ridge` has no "previous" link and `/machines/apex` has no "next").

- [ ] **Step 7: Commit**

```bash
git add src/pages/machines/\[slug\].astro src/styles/global.css
git commit -m "Restructure router detail pages around buyer questions"
```

---

### Task 8: Restructure the laser detail page

**Files:**
- Modify: `src/pages/machines/laser/[slug].astro`

**Interfaces:**
- Consumes: `PhotoSlot` (Task 2), `TrustBand` (Task 3), `META.keySpecs`/`bestFor` (Task 1).
- Produces: nothing.

The laser page has its own scoped `<style>` block duplicating `.model-overview`, `.spec-strip` etc. Because `global.css` now owns `.spec-strip`, do **not** redeclare it here.

- [ ] **Step 1: Apply the same changes as Task 7 steps 1–4**, using `../../../components/` import paths.

Keep the existing `.placeholder-banner` (laser pricing is still provisional) — it must remain visible above the price box.

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: build completes, both laser detail pages generated.

In the browser, confirm `/machines/laser/co2` shows the placeholder-pricing banner, the photo placeholder, the spec strip, and the trust band.

- [ ] **Step 3: Commit**

```bash
git add src/pages/machines/laser/\[slug\].astro
git commit -m "Restructure laser detail pages to match router layout"
```

---

### Task 9: Correct homepage spec claims

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Every correction below comes from the spec's Data Corrections table. The Apex ATC claim **stays** — the owner confirmed the machine has it.

- [ ] **Step 1: Fix the featured-machine spec block (Summit)**

- `4HP Air-Cooled` → `3HP Air-Cooled`
- `6-Zone Vacuum` → `Full Vacuum Table`
- Delete the `VACUUM / 6HP Regenerative Pump` spec item (not stated in Zoho)
- Delete the `COMM / Ethernet` spec item (not stated in Zoho)

- [ ] **Step 2: Fix the Summit package card feature list**

- `4HP Air-Cooled Spindle` → `3HP Air-Cooled Spindle`
- `6-Zone Vacuum Table` → `Full Vacuum Table`
- Delete `6HP Regenerative Vacuum Pump`
- Delete `Ethernet Communication`

- [ ] **Step 3: Fix the Apex package card feature list**

- Keep `12HP Auto Tool Change Spindle` (owner-confirmed)
- Keep `AC Servo Motors`
- Delete `Pneumatic Alignment Pins` (not stated in Zoho)
- Delete `Integrated Dust Collection` (not stated in Zoho)
- `6-Zone Vacuum Table` → `Vacuum System`

- [ ] **Step 4: Fix the comparison table rows**

- Ascent `Spindle HP`: `2HP` → `2.5HP`
- Summit `Spindle HP`: `4HP` → `3HP`
- Ascent `Power Requirement`: `110V` → `220V Single Phase` (override #3)
- Apex `Power Requirement`: **leave `220V 3-Phase` unchanged** (override #2 — the existing copy is correct)
- Summit `Vacuum Table`: `✓ 6-Zone` → `✓ Full`
- Apex `Vacuum Table`: `✓ 6-Zone` → `✓ Yes`

- [ ] **Step 4b: Remove the false 110V claims (override #3 — highest priority)**

Search the whole `src/` tree, not just the homepage, and remove or correct every Ascent 110V / household-power / no-electrician claim:

```bash
grep -rniE "110V|household power|household outlet|no electrician|without an electrician" src/
```

Known locations: the Ascent package card's `Standard household power (110V)` feature bullet (replace with `220V Single-Phase Power`), and any equivalent phrasing on `src/pages/faq.astro` and `src/pages/about.astro`. The `CO2 Laser Series` keySpecs legitimately mention 110V — laser specs are unaffected by this override, so leave them alone.

- [ ] **Step 5: Reconcile the Ascent package card label**

The card currently reads `Ascent Series / Starter`. Ascent is now badged `MID-RANGE` on `/machines`, so `Starter` contradicts it. Change the Ascent card's `pkg-name` from `Starter` to `Entry Platform` — accurate (110V, no electrician) without claiming the cheapest tier, which is now Ridge.

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: build completes.

Then confirm no stale claims remain:
```bash
grep -nE "4HP|6-Zone|Regenerative|Ethernet Communication|Pneumatic Alignment|Integrated Dust|3-Phase" src/pages/index.astro
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro
git commit -m "Correct homepage spec claims to match Zoho catalog"
```

---

### Task 10: Re-sync Dwight's catalog snapshot

**Files:**
- Create: `scripts/sync-zoho-catalog.mjs`
- Modify: `src/lib/machine_catalog.json`

**Interfaces:**
- Consumes: `.env` credentials (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ORG_ID`).
- Produces: refreshed `src/lib/machine_catalog.json` with current prices.

`src/lib/machine_catalog.json` powers Dwight's chat and is stale after the owner's Zoho price update — Dwight would quote old prices and offer the discontinued Ascent 5×10. `zoho.js` cannot be reused directly because it reads `import.meta.env`, which Node does not provide.

- [ ] **Step 1: Create the sync script**

```js
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
);

const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    refresh_token: env.ZOHO_REFRESH_TOKEN,
  }),
});
const { access_token } = await tokenRes.json();
if (!access_token) throw new Error('Zoho token refresh failed');

const res = await fetch(
  `https://www.zohoapis.com/invoice/v3/items?organization_id=${env.ZOHO_ORG_ID}&status=active&per_page=200`,
  { headers: { Authorization: `Zoho-oauthtoken ${access_token}` } }
);
const { items = [] } = await res.json();

const existing = JSON.parse(fs.readFileSync('src/lib/machine_catalog.json', 'utf8'));

// `line` values in the existing file are hand-assigned (e.g. 'Summit', 'BoreLine',
// 'Plasma') and are NOT derivable from the SKU — deriving them would silently
// change them and break findMachinesByLine() in netlify/functions/chat.mjs.
// Preserve the existing value per item; only fall back for genuinely new items.
const lineBySku = Object.fromEntries(existing.machines.map(m => [m.sku, m.line]));
const lineByName = Object.fromEntries(existing.machines.map(m => [m.name, m.line]));

const KEYWORDS = ['SPARK','ION','PRIME','ASCENT','RIDGE','SUMMIT','APEX','BORELINE'];
const machines = items
  .filter(i => KEYWORDS.some(k => i.name.toUpperCase().includes(k)))
  .map(i => {
    const line = lineBySku[i.sku] ?? lineByName[i.name] ?? null;
    if (line === null) {
      console.warn(`NEW ITEM with no known line: ${i.name} (${i.sku}) — assign its line manually before committing.`);
    }
    return {
      item_id: i.item_id, name: i.name, sku: i.sku, price: i.rate,
      description: i.description, status: i.status,
      product_type: i.product_type, line: line ?? '',
    };
  });

// Laser items are placeholder-only and live in laser_catalog.json; preserve them.
const lasers = existing.machines.filter(m => String(m.line).startsWith('LASER'));

fs.writeFileSync('src/lib/machine_catalog.json',
  JSON.stringify({ machines: [...machines, ...lasers] }, null, 2) + '\n');
console.log(`Synced ${machines.length} Zoho machines + ${lasers.length} laser placeholders.`);
```

- [ ] **Step 2: Run the sync**

Run: `node scripts/sync-zoho-catalog.mjs`
Expected: prints a synced count. If Zoho auth fails, stop and report — do not hand-edit prices into the JSON.

- [ ] **Step 3: Verify the prices match the live site**

```bash
node -e "const c=require('./src/lib/machine_catalog.json'); c.machines.filter(m=>/Ascent|Ridge|SUMMIT|APEX/i.test(m.name)).forEach(m=>console.log(m.name, m.price));"
```
Expected: Ascent 4x4 = 8400, Ascent 4x8 = 9900, no Ascent 5x10, Summit 4x4 = 18400, APEX = 28400.

- [ ] **Step 4: Verify the `line` field still groups correctly**

```bash
node -e "const c=require('./src/lib/machine_catalog.json'); console.log([...new Set(c.machines.map(m=>m.line))].join(', '));"
```
Expected: includes `ASCENT`, `RIDGE`, `SUMMIT`, `APEX`, `LASER-CO2`, `LASER-FIBER`. If the derived `line` values differ from the previous file's values, fix the derivation before committing — `findMachinesByLine` in `netlify/functions/chat.mjs` matches on this field.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-zoho-catalog.mjs src/lib/machine_catalog.json
git commit -m "Add Zoho sync script and refresh Dwight's catalog snapshot"
```

---

### Task 11: Upgrade the custom build section

**Files:**
- Modify: `src/pages/machines.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

This implements the spec's "standard first, custom as strong exit" decision. The existing `#custom` section is a single generic paragraph; it becomes a real section naming concrete jobs so a high-end buyer recognizes their own requirement. Tasks 5 and 6 also modify this file — apply this on top of their changes.

- [ ] **Step 1: Replace the body of the existing `<section id="custom">` with the expanded version**

Keep the section's existing `id="custom"` and dark background so the jump-nav anchor keeps working.

```astro
    <div class="container text-center">
      <p class="section-label">Custom</p>
      <h2 class="section-title white">If It Doesn't Exist Off the Shelf, We Build It</h2>
      <div class="title-rule" style="margin-left:auto; margin-right:auto;"></div>
      <p class="section-sub" style="color:#aaa; max-width:640px; margin-left:auto; margin-right:auto;">
        Standard sizes are only where we start. Most of what we build is configured around a
        specific job — tell us what you're cutting and we'll tell you exactly what it takes.
      </p>
      <div class="custom-examples">
        <div class="custom-example">
          <h3>Non-Standard Sizes</h3>
          <p>An 8×30 bed. A machine sized around your material, not a catalog page.</p>
        </div>
        <div class="custom-example">
          <h3>Purpose-Built Configurations</h3>
          <p>Spindle, drive system, and tooling chosen for what you actually cut every day.</p>
        </div>
        <div class="custom-example">
          <h3>Automation &amp; Add-Ons</h3>
          <p>Tool changers, vacuum zoning, dust collection, and workholding built in from the start.</p>
        </div>
      </div>
      <a href="/#contact" class="btn btn-primary" style="margin-top:36px;">Talk to Us About a Custom Build</a>
    </div>
```

- [ ] **Step 2: Add styles**

```css
.custom-examples { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 24px; margin-top: 40px; text-align: left; }
.custom-example { border-left: 3px solid var(--accent); padding-left: 16px; }
.custom-example h3 { font-family: var(--font-head); font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--white); margin-bottom: 6px; }
.custom-example p { font-size: 0.88rem; line-height: 1.6; color: #aaa; }
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: build completes.

In the browser, confirm the `Custom Builds` jump-nav pill still scrolls to the section and that the three example blocks render side by side on desktop and stack on mobile.

- [ ] **Step 4: Commit**

```bash
git add src/pages/machines.astro src/styles/global.css
git commit -m "Upgrade custom build section with concrete examples"
```

---

## Final verification

- [ ] `npm run build` completes with 15 pages.
- [ ] `/machines` shows every series' price and key specs with zero clicks.
- [ ] Ridge precedes Ascent, badged `ENTRY` and `MID-RANGE` respectively.
- [ ] Comparison table renders and scrolls with a locked first column on mobile.
- [ ] `grep -nE "4HP|6-Zone|Regenerative|Ethernet Communication|3-Phase" src/pages/index.astro` returns nothing.
- [ ] Photo placeholders look deliberate on both `/machines` and every detail page.
- [ ] The `Custom Builds` jump-nav pill still scrolls to the upgraded `#custom` section.
- [ ] Dwight quotes current prices: `node -e "const c=require('./src/lib/machine_catalog.json'); console.log(c.machines.find(m=>m.name.includes('Ascent 4x4')).price)"` prints `8400`.
- [ ] Browser console shows no errors beyond the known missing `/images/*.jpg` 404s.
