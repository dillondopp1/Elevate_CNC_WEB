# Store Pages Redesign — Design Spec

**Date:** 2026-09-01
**Scope:** `/machines`, `/machines/[slug]`, `/machines/laser/[slug]`, plus the homepage spec claims corrected under Data Corrections (the homepage package cards, featured-machine block, and comparison table state machine specs, so they fall under the same "no spec contradicts Zoho" requirement).

## Goal

Make the store pages easier to navigate and raise buyer confidence for $5,500–$38,400 industrial CNC purchases.

## Constraints

- **No machine photos available.** Design must be photo-ready but must not depend on imagery to carry confidence. Placeholders must look deliberate, not broken.
- **Standard-first, custom as strong exit.** Lead with the browsable standard lineup; thread a well-designed custom-build path throughout rather than burying it.
- **Zoho is the authoritative spec source** (one confirmed exception: Apex ATC — see Data Corrections).
- Conversion model is lead-gen (quote request), not e-commerce checkout. No cart.

## Problems with the current pages

1. **Accordion hides everything.** Every series is collapsed by default. A buyer cannot see a single spec or compare two machines without clicking back and forth from memory.
2. **No comparison.** Five router series with no side-by-side view, which is how equipment buyers actually decide.
3. **No trust signals at the decision point.** Warranty, training, financing, and support live on the homepage, not where the buying decision happens.
4. **Detail pages are spec dumps.** Raw parsed Zoho text with no buyer-oriented framing, no at-a-glance summary, no "is this the right machine for me."
5. **Broken-looking image slots.** Missing `/images/*.jpg` files render as empty boxes.

## Design

### `/machines` page structure

1. Hero + jump nav — unchanged.
2. **Trust band** (new) — thin strip under the jump nav: published pricing, 1-year warranty, setup & training included, financing available.
3. **Machine cards** (new, replaces accordion) — always-visible, no click required:
   - Photo slot (branded placeholder until photos exist)
   - Tier badge; "Most Popular" flag on Summit Series only (matches the existing homepage treatment)
   - Series name + tagline
   - Series-level key specs (see Key Specs Rule below)
   - Starting price + estimated monthly payment
   - Available sizes
   - `View Full Specs` + `Get a Quote` CTAs
4. **Router comparison table** (new) — all five router series side by side. Reuses the existing `.comp-table` styling from the homepage for visual consistency. Horizontal scroll with locked first column on mobile.
5. **Lasers / Specialty** — same card treatment. Laser section keeps its placeholder-pricing banner.
6. **Plasma** — same card treatment, stays de-emphasized and absent from the jump nav (archived).
7. **Custom build section** — upgraded from footer afterthought to a real section naming concrete examples (8×30 with ATC, non-standard bed sizes, purpose-built configurations).

### Key Specs Rule

**Specs that vary across configurations must not be presented as series-level facts.**

Discovered during spec verification: the Summit spindle varies by size — 3 HP on the 4×4 and 4×8, 10 HP on the 6×12, 6 HP ATC on the Summit ATC. A single "Summit = 4HP" claim is wrong for three of four configurations.

Therefore:

- **Cards show series-level constants only** — frame, drive system, control software, power requirement. These are consistent within a series.
- **Size-varying specs** (spindle HP, working area, price) appear in the comparison table and the per-configuration cards, where they can be stated per size.
- Where a series genuinely does not state a spec in Zoho, **omit the row** rather than guess.

### Detail pages (`/machines/[slug]`, `/machines/laser/[slug]`)

Reordered so the top fold answers the buyer's actual first questions:

1. Hero — unchanged.
2. **Photo + at-a-glance spec strip** (new) — the key specs immediately, not buried.
3. Price box with quote + financing CTAs — unchanged.
4. **"Best suited for"** (new) — one line naming the shop type, so a buyer can self-disqualify quickly.
5. Configurations grid — unchanged.
6. **"What's included" band** (new) — warranty, setup, training, software, support, financing.
7. Full specifications — unchanged (complete parsed spec sheet).
8. Custom CTA + prev/next — unchanged.

### Components

Four new Astro components, each with a single responsibility:

| Component | Responsibility |
|---|---|
| `MachineCard.astro` | One series card: badge, specs, price, CTAs |
| `TrustBand.astro` | Reusable risk-reversal strip |
| `PhotoSlot.astro` | Renders an image, or a branded placeholder when none exists |
| `RouterComparison.astro` | The side-by-side router spec table |

Per-series data (`keySpecs`, `bestFor`, optional `image`) is added to the existing `META` object in `src/lib/machine_meta.js`. This is explicit hand-curated data sourced from Zoho descriptions, **not** parsed from description text at runtime — runtime parsing is fragile and would silently produce wrong specs.

The accordion markup and its `.series-toggle` toggle script are removed entirely. Net result is less code than before.

### PhotoSlot behavior

`PhotoSlot` takes an optional `src`. When absent, it renders a branded placeholder (dark gradient, logo mark, series name) that reads as intentional. When a real photo path is set in `META`, it swaps in automatically with no code change.

## Data Corrections (separate from the redesign)

Spec verification found site copy that contradicts the Zoho catalog. User has confirmed **Zoho is authoritative**, with one exception.

To correct on the site:

| Location | Current site claim | Correct to |
|---|---|---|
| Homepage Summit card + featured block | 4HP Air-Cooled Spindle | 3 HP air-cooled (4×4 / 4×8) |
| Homepage Summit card + featured block | 6-Zone Vacuum Table | Full vacuum table |
| Homepage Summit card + featured block | 6HP Regenerative Vacuum Pump | Remove — not stated in Zoho |
| Homepage Summit featured block | Ethernet Communication | Remove — not stated in Zoho |
| Homepage Apex card | Pneumatic Alignment Pins | Remove — not stated in Zoho |
| Homepage Apex card | Integrated Dust Collection | Remove — not stated in Zoho |
| Homepage Apex card + comparison table | 6-Zone Vacuum Table | Vacuum system (zone count not stated) |
| Homepage comparison table | Apex: 220V 3-Phase | **220V Single Phase** |
| Homepage comparison table | Ascent: 2HP | 2.5 HP Skil router |
| Homepage comparison table | Summit: 4HP | 3 HP (4×4 / 4×8) |

**Confirmed exception — Apex ATC.** User confirms the Apex does ship with an automatic tool changer; Zoho's Apex description omits it. The site copy stays. **Consequence to flag:** the Apex detail page renders its spec sheet live from Zoho, so until the Zoho description is updated, the page will advertise ATC on the card above a spec sheet that never mentions one. Zoho's Apex entry should be updated to include the tool changer.

### Zoho data quality issues to fix (owner action, not code)

1. **`Elevate CNC SUMMIT 6x12` description is titled "(4×8)"** — copy-paste error. Working area inside is correct (72 × 144 in). Not currently rendered on the site, but wrong in the source of truth.
2. **Apex description omits the automatic tool changer** (see above).
3. Live Zoho contains a **Summit 5×10 ($26,800)** variant absent from the local `machine_catalog.json` snapshot, so Dwight's chat does not know it exists.

## Out of scope (YAGNI)

- **Guided machine-finder quiz** — Dwight already performs this qualification in chat; a quiz duplicates existing capability and adds friction for expert buyers.
- Cart / checkout — conversion model is quote-request.
- Save/compare-checkbox interactive tooling — overkill for five router series.
- Per-machine video or 360 viewers — no assets exist.

## Success criteria

- A visitor can see every series' price and key specs on `/machines` without a single click.
- Two router series can be compared side by side without navigation.
- No spec shown anywhere on the site contradicts the Zoho catalog (except the confirmed Apex ATC).
- Placeholder image states look deliberate, and swap to real photos with no code change.
