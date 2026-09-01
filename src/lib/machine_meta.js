/** Shared series metadata + slug mapping, used by /machines and /machines/[slug]. */

export const META = {
  'Spark Series':  { badge:'ENTRY',       cls:'badge-entry',      tagline:'Entry-Level Plasma Table',            intro:'Compact, affordable plasma tables for hobbyists, makers, and small shops. Touchscreen control, Wi-Fi, USB, and TF card support — no computer required during operation.' },
  'ION Series':    { badge:'MID-TIER',    cls:'badge-mid',        tagline:'Mid-Tier CNC Plasma Table',           intro:'Upgraded from the Spark with NEMA 23 motors, 20 mm timing belts, and a motorized Z-axis with floating touch-off for automatic material sensing and better cut consistency.' },
  'Prime Series':  { badge:'PRODUCTION',  cls:'badge-pro',        tagline:'Production-Grade Plasma Table',       intro:'Production-ready with integrated Torch Height Control (THC), rack-and-pinion drive on all axes, and travel speeds up to 800 IPM. Optional water table upgrade available.' },
  'Ascent Series': { badge:'ENTRY',       cls:'badge-entry',      tagline:'Entry-Level CNC Router',              intro:'Runs on standard 110V household power — no industrial electrical service required. Welded steel base, aluminum extrusion gantry, FluidNC control. A real CNC platform, not a kit.' },
  'Ridge Series':  { badge:'MID-RANGE',   cls:'badge-mid',        tagline:'Extrusion-Based CNC Router',          intro:'Rigid aluminum extrusion frame with rack-and-pinion drive and Centroid CNC12 control. X/Y resolution to 0.0005". Modular design supports future upgrades and custom configurations.' },
  'Summit Series': { badge:'PRODUCTION',  cls:'badge-pro',        tagline:'Industrial Production CNC Router',    intro:'Fully welded steel frame, helical rack-and-pinion drive, full vacuum table, auto-lubrication, and Centroid CNC12. Built for cabinet shops and sign makers who need daily reliability.' },
  'Summit ATC':    { badge:'PRODUCTION+', cls:'badge-pro',        tagline:'Summit with Automatic Tool Change',   intro:'The full Summit platform upgraded with a 6HP ATC spindle, 8-position linear tool rack, BT30/ER25 holders, and automatic tool length setter. Compressed air required for operation.' },
  'Apex Series':   { badge:'INDUSTRIAL',  cls:'badge-industrial', tagline:'Industrial Production CNC Router',    intro:'1500W AC servo motors with closed-loop feedback, 12HP spindle, 1,200 IPM rapid speed, centralized auto-lubrication, and Centroid CNC12. The flagship router in the Elevate CNC lineup.' },
  'BoreLine':      { badge:'SPECIALTY',   cls:'badge-specialty',  tagline:'Double-Head Side Hole Drilling',      intro:'Purpose-built for production cabinet and furniture shops. Dual 3HP horizontal spindles, laser probe positioning, barcode scanning, and pneumatic material clamping. 110 in operating stroke.' },
  'Summit Lathe':  { badge:'SPECIALTY',   cls:'badge-specialty',  tagline:'CNC Wood Lathe',                      intro:'One-piece cast iron bed with Taiwan Hiwin rails, TBI ballscrews, and a 7.4HP main motor. Optional lengths to 118 in. Designed for furniture makers, stair builders, and column shops.' },
  'CO2 Laser Series':   { badge:'ENTRY',      cls:'badge-entry', tagline:'CO2 Laser Cutter & Engraver',     intro:'Cuts and engraves wood, acrylic, leather, fabric, and other non-metals. A sealed CO2 tube system built for makers, sign shops, and small production runs that need clean edges without router setup.' },
  'Fiber Laser Series': { badge:'PRODUCTION',  cls:'badge-pro',    tagline:'Fiber Laser Marking & Cutting',   intro:'Marks and cuts metal — mild steel, stainless, aluminum, and more — with a clean, fast, no-contact process. No consumables, no secondary finishing.' },
};

/** Router series get individual detail pages at /machines/{slug}. */
export const ROUTER_SLUGS = {
  'ascent': 'Ascent Series',
  'ridge': 'Ridge Series',
  'summit': 'Summit Series',
  'summit-atc': 'Summit ATC',
  'apex': 'Apex Series',
};

/** Laser series get individual detail pages at /machines/laser/{slug}. */
export const LASER_SLUGS = {
  'co2': 'CO2 Laser Series',
  'fiber': 'Fiber Laser Series',
};

export function slugForSeries(seriesName) {
  return Object.keys(ROUTER_SLUGS).find(slug => ROUTER_SLUGS[slug] === seriesName) || null;
}

export function laserSlugForSeries(seriesName) {
  return Object.keys(LASER_SLUGS).find(slug => LASER_SLUGS[slug] === seriesName) || null;
}
